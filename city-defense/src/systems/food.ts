import type { World, Season } from '../world/world.ts';
import { each } from '../ecs/store.ts';
import { buildingDef } from '../data/buildings.ts';
import { CONFIG } from '../data/config.ts';

export function foodStorageCap(world: World): number {
  let cap = CONFIG.baseFoodStorageCap;
  each(world.components.building, (_, b) => {
    if (b.state !== 'operational') return;
    const def = buildingDef(b.kind);
    if (def.foodStorage) cap += def.foodStorage;
  });
  return cap;
}

export function seasonFoodMultiplier(season: Season): number {
  return CONFIG.seasonFoodMultiplier[season];
}

// Per-tick production: each operational producer contributes
// (perDay * seasonMult) / ticksPerGameDay. Stockpile is clamped to capacity
// so over-production rots silently (player must build warehouses to keep up).
export function produceResourcesTick(world: World): void {
  const seasonMult = seasonFoodMultiplier(world.season);
  let foodOut = 0;
  let goldOut = 0;
  each(world.components.building, (_, b) => {
    if (b.state !== 'operational') return;
    const def = buildingDef(b.kind);
    const out = def.output;
    if (!out) return;
    const perTick = out.perDay / CONFIG.ticksPerGameDay;
    if (out.resource === 'food') foodOut += perTick * seasonMult;
    else if (out.resource === 'gold') goldOut += perTick;
  });
  world.resources.food = Math.min(world.resources.food + foodOut, foodStorageCap(world));
  world.resources.gold += goldOut;
}

export interface DailyFoodReport {
  required: number;
  consumed: number;
  starvationDeaths: number;
}

// Daily consumption: pop + soldiers eat. Shortfall causes starvation deaths.
// Rationing policy can halve the per-citizen amount (lowering morale).
export function consumeFoodDay(world: World): DailyFoodReport {
  const rationing = world.policy.rationing;
  const citizenRate = rationing === 'half' ? CONFIG.foodPerCitizenPerDay * 0.5 : CONFIG.foodPerCitizenPerDay;
  const soldierRate = rationing === 'starve-soldiers' ? 0 : CONFIG.foodPerSoldierPerDay;

  const soldiers = world.components.soldier.map.size;
  const required = world.population.total * citizenRate + soldiers * soldierRate;

  if (world.resources.food >= required) {
    world.resources.food -= required;
    world.population.daysWithoutFood = 0;
    return { required, consumed: required, starvationDeaths: 0 };
  }

  const consumed = world.resources.food;
  const deficit = required - consumed;
  world.resources.food = 0;
  world.population.daysWithoutFood += 1;

  // One unit of unmet food = one death (citizens preferred over soldiers).
  let deaths = Math.floor(deficit);
  const before = world.population.total;
  world.population.total = Math.max(0, before - deaths);
  const actualCitizenDeaths = before - world.population.total;
  world.population.starvationDeaths += actualCitizenDeaths;
  drainJobs(world, actualCitizenDeaths);

  // Any remaining deficit kills soldiers (one for one).
  const soldierDeaths = deaths - actualCitizenDeaths;
  if (soldierDeaths > 0) {
    let n = soldierDeaths;
    for (const id of [...world.components.soldier.map.keys()]) {
      if (n <= 0) break;
      world.components.soldier.map.delete(id);
      world.components.duty.map.delete(id);
      n -= 1;
    }
  }
  return { required, consumed, starvationDeaths: actualCitizenDeaths };
}

// Pull deaths proportionally from the largest job groups so the pool stays
// sensible even after many starvation rounds.
function drainJobs(world: World, deaths: number): void {
  if (deaths <= 0) return;
  const jobs = world.population.byJob;
  let remaining = deaths;
  while (remaining > 0) {
    let largest: keyof typeof jobs | null = null;
    let largestN = 0;
    for (const k of Object.keys(jobs) as (keyof typeof jobs)[]) {
      if (jobs[k] > largestN) { largestN = jobs[k]; largest = k; }
    }
    if (!largest || largestN === 0) return;
    jobs[largest] -= 1;
    remaining -= 1;
  }
}

export function daysOfFoodRemaining(world: World): number {
  const soldiers = world.components.soldier.map.size;
  const required = world.population.total * CONFIG.foodPerCitizenPerDay
                 + soldiers * CONFIG.foodPerSoldierPerDay;
  if (required <= 0) return Infinity;
  return Math.floor(world.resources.food / required);
}
