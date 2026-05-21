import type { World, ArmyComposition, Job } from '../world/world.ts';
import { effectiveBuff } from '../world/world.ts';
import type { UnitKind } from '../ecs/components.ts';
import type { EntityId } from '../ecs/store.ts';
import { allocate, setComponent } from '../ecs/store.ts';
import { UNITS } from '../data/units.ts';
import { CONFIG } from '../data/config.ts';
import { nextFloat } from '../engine/rng.ts';
import { getBuildingAt, inBounds } from '../world/tilemap.ts';

// Spawn the starting army chosen on the setup screen. Soldiers begin on
// 'reserve' duty; the duty panel reassigns them during the prep phase.
export function spawnStartingArmy(world: World, comp: ArmyComposition): void {
  const keepX = Math.floor(CONFIG.mapWidth / 2);
  const keepY = Math.floor(CONFIG.mapHeight / 2);
  let placedCount = 0;

  for (const [kindStr, count] of Object.entries(comp)) {
    if (!count || count <= 0) continue;
    const kind = kindStr as UnitKind;
    const def = UNITS[kind];
    for (let i = 0; i < count; i++) {
      const id = allocate(world.entities);
      // Spiral out from the keep so units don't all sit on one tile.
      const ring = 1 + Math.floor(placedCount / 8);
      const ringIdx = placedCount % 8;
      const dx = [1, 1, 0, -1, -1, -1, 0, 1][ringIdx]! * ring;
      const dy = [0, 1, 1, 1, 0, -1, -1, -1][ringIdx]! * ring;
      setComponent(world.components.position, id, { x: keepX + dx, y: keepY + dy });
      setComponent(world.components.soldier, id, {
        unit: kind,
        named: false,
        loyalty: 80,
        attackCooldown: 0,
        moveCooldown: 0,
      });
      setComponent(world.components.health, id, { hp: def.hp, max: def.hp });
      setComponent(world.components.duty, id, { kind: 'reserve' });
      placedCount += 1;
    }
  }
}

export function armyGoldCost(comp: ArmyComposition): number {
  let g = 0;
  for (const [k, n] of Object.entries(comp)) {
    if (!n) continue;
    g += UNITS[k as UnitKind].goldCost * n;
  }
  return g;
}

export function armyDailyFoodCost(comp: ArmyComposition): number {
  let f = 0;
  for (const [k, n] of Object.entries(comp)) {
    if (!n) continue;
    f += UNITS[k as UnitKind].foodPerDay * n;
  }
  return f;
}

export function armyDailyUpkeep(comp: ArmyComposition): number {
  let u = 0;
  for (const [k, n] of Object.entries(comp)) {
    if (!n) continue;
    u += UNITS[k as UnitKind].upkeepGoldPerDay * n;
  }
  return u;
}

export function totalSoldiers(comp: ArmyComposition): number {
  let s = 0;
  for (const [, n] of Object.entries(comp)) if (n) s += n;
  return s;
}

// ─── Phase 7: live recruitment during the campaign ────────────────────────

export interface RecruitResult {
  ok: boolean;
  reason?: string;
  count: number;
}

export function peasantConscriptCost(world: World): number {
  // recruitCostPct multiplies. Veteran Knight's +5% makes recruits 5% pricier.
  const mult = 1 + effectiveBuff(world, 'recruitCostPct') / 100;
  return Math.ceil(CONFIG.peasantLevyGoldCost * mult);
}

export function mercenaryHireCost(world: World): number {
  // mercDiscountPct reduces (Diplomat: 25% off).
  const discount = 1 - effectiveBuff(world, 'mercDiscountPct') / 100;
  return Math.ceil(UNITS.mercenary.goldCost * discount);
}

// Conscript N peasants. Costs gold per head; drains workers from the pool
// (idle first, then largest non-essential job, then farmers).
export function conscriptPeasants(world: World, count: number): RecruitResult {
  if (count <= 0) return { ok: false, reason: 'bad count', count: 0 };
  const goldPer = peasantConscriptCost(world);
  const totalGold = goldPer * count;
  if (world.resources.gold < totalGold) {
    return { ok: false, reason: 'not enough gold', count: 0 };
  }
  const available = conscriptablePopulation(world);
  if (available < count) {
    return { ok: false, reason: 'not enough peasants', count: 0 };
  }

  world.resources.gold -= totalGold;
  drainWorkers(world, count);
  world.population.total = Math.max(0, world.population.total - count);
  for (let i = 0; i < count; i++) {
    spawnSoldier(world, 'peasant-levy', 70);
  }
  return { ok: true, count };
}

export function hireMercenaries(world: World, count: number): RecruitResult {
  if (count <= 0) return { ok: false, reason: 'bad count', count: 0 };
  const goldPer = mercenaryHireCost(world);
  const totalGold = goldPer * count;
  if (world.resources.gold < totalGold) {
    return { ok: false, reason: 'not enough gold', count: 0 };
  }
  world.resources.gold -= totalGold;
  for (let i = 0; i < count; i++) {
    spawnSoldier(world, 'mercenary', CONFIG.mercenaryStartingLoyalty);
  }
  return { ok: true, count };
}

export interface UpkeepReport {
  upkeepPaid: number;
  upkeepShortfall: number;
  desertions: number;
}

// Daily: deduct gold upkeep for every soldier, then roll desertions for
// mercenaries when the treasury is short or morale has tanked.
export function processSoldierUpkeepDay(world: World): UpkeepReport {
  const upkeepMult = 1 + effectiveBuff(world, 'upkeepCostPct') / 100;
  let upkeep = 0;
  for (const s of world.components.soldier.map.values()) {
    upkeep += UNITS[s.unit].upkeepGoldPerDay;
  }
  upkeep *= upkeepMult;

  let shortfall = 0;
  if (world.resources.gold >= upkeep) {
    world.resources.gold -= upkeep;
  } else {
    shortfall = upkeep - world.resources.gold;
    world.resources.gold = 0;
  }

  // Desertion check. Triggers from low gold OR low morale; both can stack.
  // Treasury shortfall raises the chance further.
  const lowGold = world.resources.gold < CONFIG.mercenaryDesertGoldThreshold;
  const lowMorale = world.population.morale < CONFIG.mercenaryDesertMoraleThreshold;
  let chance = 0;
  if (lowGold) chance += CONFIG.mercenaryDesertGoldChance;
  if (lowMorale) chance += CONFIG.mercenaryDesertMoraleChance;
  if (shortfall > 0) chance += CONFIG.mercenaryDesertGoldChance;     // unpaid: doubled risk

  let desertions = 0;
  if (chance > 0) {
    for (const id of [...world.components.soldier.map.keys()]) {
      const s = world.components.soldier.map.get(id);
      if (!s || s.unit !== 'mercenary') continue;
      if (nextFloat(world.rng) < chance) {
        removeSoldier(world, id);
        desertions += 1;
      }
    }
  }
  world.population.mercenaryDesertions += desertions;
  return { upkeepPaid: upkeep - shortfall, upkeepShortfall: shortfall, desertions };
}

// Returns the number of peasants who can be conscripted before gutting the
// city. Pulls from idle first; then the four 'safe' jobs (labourer,
// craftsman, merchant, priest); then farmers, but only down to the bare
// minimum needed to keep food production possible.
export function conscriptablePopulation(world: World): number {
  const j = world.population.byJob;
  const fromIdle = j.idle;
  const fromSafe = j.labourer + j.craftsman + j.merchant + j.priest;
  // Always leave at least 20 farmers so the city isn't immediately starved.
  const FARMER_FLOOR = 20;
  const fromFarmer = Math.max(0, j.farmer - FARMER_FLOOR);
  return fromIdle + fromSafe + fromFarmer;
}

function drainWorkers(world: World, count: number): void {
  const j = world.population.byJob;
  const order: Job[] = ['idle', 'labourer', 'craftsman', 'merchant', 'priest', 'farmer'];
  let remaining = count;
  for (const jobName of order) {
    if (remaining <= 0) break;
    const floor = jobName === 'farmer' ? 20 : 0;
    const can = Math.max(0, j[jobName] - floor);
    const take = Math.min(can, remaining);
    j[jobName] -= take;
    remaining -= take;
  }
}

function spawnSoldier(world: World, unit: UnitKind, loyalty: number): EntityId {
  const def = UNITS[unit];
  const keepX = Math.floor(CONFIG.mapWidth / 2);
  const keepY = Math.floor(CONFIG.mapHeight / 2);
  const tile = findFreeTile(world, keepX, keepY);
  const id = allocate(world.entities);
  setComponent(world.components.position, id, { x: tile.x, y: tile.y });
  setComponent(world.components.soldier, id, {
    unit, named: false, loyalty, attackCooldown: 0, moveCooldown: 0,
  });
  setComponent(world.components.health, id, { hp: def.hp, max: def.hp });
  setComponent(world.components.duty, id, { kind: 'reserve' });
  return id;
}

// Spiral out from the keep looking for a tile with no building on it.
function findFreeTile(world: World, cx: number, cy: number): { x: number; y: number } {
  for (let r = 1; r < 20; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = cx + dx, y = cy + dy;
        if (!inBounds(world.tilemap, x, y)) continue;
        if (getBuildingAt(world.tilemap, x, y) !== null) continue;
        return { x, y };
      }
    }
  }
  return { x: cx, y: cy };
}

function removeSoldier(world: World, id: EntityId): void {
  world.components.soldier.map.delete(id);
  world.components.position.map.delete(id);
  world.components.health.map.delete(id);
  world.components.duty.map.delete(id);
}

// Live aggregate accessor: total daily upkeep across the current soldier
// roster (factors in general's upkeepCostPct). UI uses this for the
// "Daily upkeep: Xg" readout.
export function liveDailyUpkeep(world: World): number {
  const mult = 1 + effectiveBuff(world, 'upkeepCostPct') / 100;
  let u = 0;
  for (const s of world.components.soldier.map.values()) {
    u += UNITS[s.unit].upkeepGoldPerDay;
  }
  return u * mult;
}

// Live aggregate: total daily food cost across the current soldier roster
// (factors in general's foodConsumptionPct).
export function liveDailyArmyFood(world: World): number {
  const mult = 1 + effectiveBuff(world, 'foodConsumptionPct') / 100;
  let f = 0;
  for (const s of world.components.soldier.map.values()) {
    f += UNITS[s.unit].foodPerDay;
  }
  return f * mult;
}

export function mercenaryCount(world: World): number {
  let n = 0;
  for (const s of world.components.soldier.map.values()) {
    if (s.unit === 'mercenary') n += 1;
  }
  return n;
}
