import type { World } from '../world/world.ts';
import { each, getComponent } from '../ecs/store.ts';
import { buildingDef } from '../data/buildings.ts';
import { CONFIG } from '../data/config.ts';
import { nextInt } from '../engine/rng.ts';
import { daysOfFoodRemaining } from './food.ts';

export interface MoraleBreakdown {
  base: number;
  hunger: number;
  homeless: number;
  taxes: number;
  amenities: number;
  season: number;
  siege: number;
  ration: number;
  total: number;
}

// Pure: compute the daily target morale from current world state.
export function computeMoraleTarget(world: World): MoraleBreakdown {
  const base = CONFIG.moraleBase;

  // Hunger: per day of zero food + a flat penalty if days-of-food at 0.
  const dof = daysOfFoodRemaining(world);
  const hunger =
    (dof === 0 ? CONFIG.moraleHungerWhenStarving : 0)
    + world.population.daysWithoutFood * CONFIG.moraleHungerPerDayWithoutFood;

  const homeless = world.population.homeless * CONFIG.moraleHomelessPerCitizen;

  const taxAbove = world.policy.taxRate - CONFIG.moraleTaxBaseline;
  const taxes = taxAbove * CONFIG.moraleTaxPerPoint;

  let amenities = 0;
  each(world.components.building, (_, b) => {
    if (b.state !== 'operational') return;
    const def = buildingDef(b.kind);
    if (def.moraleBonus) amenities += def.moraleBonus;
  });

  const season = world.season === 'winter' ? CONFIG.moraleSeasonalWinter : 0;
  const siege = world.phase === 'siege' ? CONFIG.moraleSiegePhase : 0;

  const ration = world.policy.rationing === 'half' ? -10
               : world.policy.rationing === 'starve-soldiers' ? -4
               : 0;

  const total = clamp01_100(base + hunger + homeless + taxes + amenities + season + siege + ration);
  return { base, hunger, homeless, taxes, amenities, season, siege, ration, total };
}

// Daily smoothing: morale drifts toward the computed target so single bad
// events don't crater the meter instantly.
const MORALE_LERP = 0.4;

export function updateMoraleDay(world: World): MoraleBreakdown {
  const breakdown = computeMoraleTarget(world);
  const cur = world.population.morale;
  world.population.morale = cur + (breakdown.total - cur) * MORALE_LERP;
  return breakdown;
}

// Riot/revolt state machine. Runs on day rollover, after morale update.
export function updateRevoltDay(world: World): void {
  if (world.gameOver) return;
  const morale = world.population.morale;

  if (morale < CONFIG.unrestThreshold) world.population.daysInUnrest += 1;
  else world.population.daysInUnrest = Math.max(0, world.population.daysInUnrest - 1);

  if (!world.population.rioting && morale < CONFIG.unrestThreshold
      && world.population.daysInUnrest >= CONFIG.unrestDaysBeforeRiot) {
    world.population.rioting = true;
  }

  if (world.population.rioting) {
    if (morale > CONFIG.unrestThreshold + 10) {
      world.population.rioting = false;
      world.population.daysInUnrest = 0;
    } else {
      damageRandomBuilding(world);
    }
  }

  // Revolt + surrender. Only triggers if a riot has already started.
  if (world.population.rioting && morale < CONFIG.revoltThreshold) {
    world.gameOver = { reason: 'revolt', day: world.day };
  }
}

function damageRandomBuilding(world: World): void {
  const ids = [...world.components.building.map.keys()];
  if (ids.length === 0) return;
  const id = ids[nextInt(world.rng, ids.length)]!;
  const hp = getComponent(world.components.health, id);
  const b = getComponent(world.components.building, id);
  if (!hp || !b) return;
  hp.hp = Math.max(0, hp.hp - CONFIG.riotDamagePerDay);
  if (hp.hp === 0) b.state = 'ruined';
  else if (hp.hp < hp.max * 0.5) b.state = 'damaged';
}

function clamp01_100(v: number): number {
  return Math.max(0, Math.min(100, v));
}
