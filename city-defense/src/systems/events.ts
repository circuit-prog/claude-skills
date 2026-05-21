import type { World } from '../world/world.ts';
import { effectiveBuff } from '../world/world.ts';
import type { EventDef, EventEffect, EventChoice, ChoiceCost } from '../data/events.ts';
import { EVENTS, findEvent, rolledEvents } from '../data/events.ts';
import type { NotableRole, NotableTrait, UnitKind, EnemyKind } from '../ecs/components.ts';
import { nextFloat, nextInt } from '../engine/rng.ts';
import { allocate, setComponent } from '../ecs/store.ts';
import { UNITS } from '../data/units.ts';
import { ENEMIES } from '../data/enemies.ts';
import { CONFIG } from '../data/config.ts';
import { getBuildingAt, inBounds } from '../world/tilemap.ts';

// Daily spawn probability when no event is showing and nothing is queued
// for today. Tuned so the player sees roughly one event every 5-7 days.
const DAILY_SPAWN_CHANCE = 0.18;

// ─── Daily entry point ────────────────────────────────────────────────────

export function advanceEventsDay(world: World): void {
  // Already showing a modal — wait for the player.
  if (world.pendingEventId) return;

  // Fire any scheduled follow-up due today.
  const dueIdx = world.queuedEvents.findIndex((q) => q.fireOnDay <= world.day);
  if (dueIdx >= 0) {
    const queued = world.queuedEvents.splice(dueIdx, 1)[0]!;
    if (findEvent(queued.defId)) {
      world.pendingEventId = queued.defId;
      return;
    }
  }

  // Random roll. Skip when in the middle of a riot — the city has enough
  // happening already.
  if (world.population.rioting) return;
  if (nextFloat(world.rng) > DAILY_SPAWN_CHANCE) return;

  const candidate = pickEligibleEvent(world);
  if (candidate) world.pendingEventId = candidate.id;
}

function pickEligibleEvent(world: World): EventDef | null {
  const eligible = rolledEvents().filter((e) => isEligible(world, e));
  if (eligible.length === 0) return null;
  const totalWeight = eligible.reduce((s, e) => s + e.weight, 0);
  if (totalWeight <= 0) return null;
  const roll = nextFloat(world.rng) * totalWeight;
  let acc = 0;
  for (const e of eligible) {
    acc += e.weight;
    if (roll < acc) return e;
  }
  return eligible[eligible.length - 1]!;
}

function isEligible(world: World, def: EventDef): boolean {
  // Cooldown
  const cd = world.eventCooldowns[def.id];
  if (cd !== undefined && world.day < cd) return false;

  const p = def.preconditions;
  if (p) {
    if (p.minDay !== undefined && world.day < p.minDay) return false;
    if (p.maxDay !== undefined && world.day > p.maxDay) return false;
    if (p.phase && p.phase !== 'any' && p.phase !== world.phase) return false;
    if (p.minMorale !== undefined && world.population.morale < p.minMorale) return false;
    if (p.maxMorale !== undefined && world.population.morale > p.maxMorale) return false;
    if (p.hasBuilding && !hasOperational(world, p.hasBuilding)) return false;
    if (p.needsNotableRole && !hasNotableWithRole(world, p.needsNotableRole)) return false;
  }
  return true;
}

function hasOperational(world: World, kind: string): boolean {
  for (const b of world.components.building.map.values()) {
    if (b.kind === kind && b.state === 'operational') return true;
  }
  return false;
}

function hasNotableWithRole(world: World, role: NotableRole): boolean {
  for (const n of world.components.notable.map.values()) {
    if (n.role === role) return true;
  }
  return false;
}

// ─── Player choice handling ───────────────────────────────────────────────

export interface ChooseResult { ok: boolean; reason?: string; }

export function choose(world: World, choiceIndex: number): ChooseResult {
  if (!world.pendingEventId) return { ok: false, reason: 'no event' };
  const def = findEvent(world.pendingEventId);
  if (!def) return { ok: false, reason: 'unknown event' };
  const choice = def.choices[choiceIndex];
  if (!choice) return { ok: false, reason: 'bad choice' };

  if (choice.cost && !canAfford(world, choice.cost)) {
    return { ok: false, reason: 'cannot afford' };
  }
  if (choice.cost) debit(world, choice.cost);

  for (const ef of choice.effects) applyEffect(world, ef);

  world.eventLog.push({ defId: def.id, choiceLabel: choice.label, day: world.day });
  if (def.cooldownDays) world.eventCooldowns[def.id] = world.day + def.cooldownDays;
  world.pendingEventId = null;
  return { ok: true };
}

function canAfford(world: World, c: ChoiceCost): boolean {
  if (c.gold !== undefined && world.resources.gold < c.gold) return false;
  if (c.food !== undefined && world.resources.food < c.food) return false;
  if (c.wood !== undefined && world.resources.wood < c.wood) return false;
  if (c.stone !== undefined && world.resources.stone < c.stone) return false;
  return true;
}

function debit(world: World, c: ChoiceCost): void {
  if (c.gold) world.resources.gold -= c.gold;
  if (c.food) world.resources.food -= c.food;
  if (c.wood) world.resources.wood -= c.wood;
  if (c.stone) world.resources.stone -= c.stone;
}

// ─── Effect dispatch ──────────────────────────────────────────────────────

function applyEffect(world: World, ef: EventEffect): void {
  switch (ef.kind) {
    case 'food': world.resources.food = Math.max(0, world.resources.food + ef.delta); return;
    case 'gold': world.resources.gold = Math.max(0, world.resources.gold + ef.delta); return;
    case 'wood': world.resources.wood = Math.max(0, world.resources.wood + ef.delta); return;
    case 'stone': world.resources.stone = Math.max(0, world.resources.stone + ef.delta); return;
    case 'morale':
      world.population.morale = clamp01_100(world.population.morale + ef.delta);
      return;
    case 'population':
      applyPopulationDelta(world, ef.delta);
      return;
    case 'loyalty-role':
      for (const n of world.components.notable.map.values()) {
        if (n.role === ef.role) n.personalLoyalty = clamp01_100(n.personalLoyalty + ef.delta);
      }
      return;
    case 'loyalty-trait':
      for (const n of world.components.notable.map.values()) {
        if (n.traits.includes(ef.trait as NotableTrait)) {
          n.personalLoyalty = clamp01_100(n.personalLoyalty + ef.delta);
        }
      }
      return;
    case 'loyalty-all':
      for (const n of world.components.notable.map.values()) {
        n.personalLoyalty = clamp01_100(n.personalLoyalty + ef.delta);
      }
      return;
    case 'spawn-enemies':
      spawnEnemies(world, ef.enemy, ef.count, ef.edge);
      return;
    case 'damage-random-wall':
      damageRandomWalls(world, ef.amount, ef.count ?? 1);
      return;
    case 'damage-keep':
      damageKeep(world, ef.amount);
      return;
    case 'spawn-soldiers':
      for (let i = 0; i < ef.count; i++) {
        spawnSoldier(world, ef.unit, ef.loyalty ?? 75);
      }
      return;
    case 'queue-followup':
      world.queuedEvents.push({ defId: ef.defId, fireOnDay: world.day + ef.afterDays });
      return;
  }
}

function applyPopulationDelta(world: World, delta: number): void {
  if (delta >= 0) {
    world.population.total += delta;
    // Spread additions into idle bucket.
    world.population.byJob.idle += delta;
    return;
  }
  const loss = -delta;
  const before = world.population.total;
  world.population.total = Math.max(0, before - loss);
  const actual = before - world.population.total;
  // Drain proportionally from largest job, like starvation.
  let remaining = actual;
  const jobs = world.population.byJob;
  while (remaining > 0) {
    let largest: keyof typeof jobs | null = null;
    let largestN = 0;
    for (const k of Object.keys(jobs) as Array<keyof typeof jobs>) {
      if (jobs[k] > largestN) { largestN = jobs[k]; largest = k; }
    }
    if (!largest || largestN === 0) break;
    jobs[largest] -= 1;
    remaining -= 1;
  }
}

function spawnEnemies(
  world: World,
  enemy: EnemyKind,
  count: number,
  edge: 'north' | 'south' | 'east' | 'west' = 'north',
): void {
  const def = ENEMIES[enemy];
  const w = world.tilemap.width, h = world.tilemap.height;
  for (let i = 0; i < count; i++) {
    let sx = 0, sy = 0;
    switch (edge) {
      case 'north': sx = Math.min(w - 1, Math.floor(w / 2) - 4 + i); sy = 0; break;
      case 'south': sx = Math.min(w - 1, Math.floor(w / 2) - 4 + i); sy = h - 1; break;
      case 'east':  sx = w - 1; sy = Math.min(h - 1, Math.floor(h / 2) - 4 + i); break;
      case 'west':  sx = 0;     sy = Math.min(h - 1, Math.floor(h / 2) - 4 + i); break;
    }
    const id = allocate(world.entities);
    setComponent(world.components.position, id, { x: sx, y: sy });
    setComponent(world.components.health, id, { hp: def.hp, max: def.hp });
    setComponent(world.components.enemy, id, {
      kind: enemy, faction: 'raiders',
      attackCooldown: 0, moveCooldown: nextInt(world.rng, def.ticksPerStep),
      path: [],
    });
  }
}

function damageRandomWalls(world: World, amount: number, count: number): void {
  const walls = [...world.components.building.map.entries()].filter(([, b]) =>
    (b.kind === 'wall' || b.kind === 'tower' || b.kind === 'gatehouse') && b.state !== 'ruined',
  );
  if (walls.length === 0) return;
  for (let i = 0; i < count && walls.length > 0; i++) {
    const idx = nextInt(world.rng, walls.length);
    const [id, b] = walls.splice(idx, 1)[0]!;
    const hp = world.components.health.map.get(id);
    if (!hp) continue;
    hp.hp = Math.max(0, hp.hp - amount);
    if (hp.hp === 0) {
      b.state = 'ruined';
      const pos = world.components.position.map.get(id);
      if (pos) world.tilemap.buildingAt[pos.y * world.tilemap.width + pos.x] = null;
    } else if (hp.hp < hp.max * 0.5) b.state = 'damaged';
  }
}

function damageKeep(world: World, amount: number): void {
  for (const [id, b] of world.components.building.map) {
    if (b.kind !== 'keep') continue;
    const hp = world.components.health.map.get(id);
    if (!hp) continue;
    hp.hp = Math.max(0, hp.hp - amount);
    if (hp.hp < hp.max * 0.5) b.state = 'damaged';
    return;
  }
}

function spawnSoldier(world: World, unit: UnitKind, loyalty: number): void {
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
  // effectiveBuff retained as an import — soldiers spawned via events use
  // identical loyalty baseline as recruitment, no buff plumbing here yet.
  void effectiveBuff;
}

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

function clamp01_100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

// ─── UI accessors ─────────────────────────────────────────────────────────

export function pendingEvent(world: World): EventDef | null {
  if (!world.pendingEventId) return null;
  return findEvent(world.pendingEventId) ?? null;
}

export function pendingChoiceAffordable(world: World, choice: EventChoice): boolean {
  if (!choice.cost) return true;
  return canAfford(world, choice.cost);
}

export function dismissEvent(world: World): void {
  // Hard dismiss without applying effects (used by save/load reset paths).
  world.pendingEventId = null;
}

// Catalogue-level helpers for tests.
export const _internals = { isEligible, pickEligibleEvent, applyEffect };
export { EVENTS };
