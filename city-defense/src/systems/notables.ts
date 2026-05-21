import type { World } from '../world/world.ts';

export const DISLOYAL_THRESHOLD = 30;

// Daily drift. Trait-driven so two notables of the same role can diverge
// over a long siege without any random-event support yet.
export function updateNotablesDay(world: World): void {
  for (const n of world.components.notable.map.values()) {
    let delta = 0;

    // Trait baseline drift
    if (n.traits.includes('loyal')) delta += 0.4;
    if (n.traits.includes('ambitious')) delta -= 0.4;
    if (n.traits.includes('cruel')) delta -= 0.1;
    if (n.traits.includes('pious') && hasOperational(world, 'chapel')) delta += 0.3;
    if (n.traits.includes('greedy') && world.resources.gold < 100) delta -= 0.8;
    if (n.traits.includes('brave') && world.phase === 'siege') delta += 0.4;
    if (n.traits.includes('cowardly') && world.phase === 'siege') delta -= 0.8;

    // Policy reactions
    if (world.policy.taxRate > 18) delta -= 0.5;
    if (world.policy.taxRate < 6 && n.traits.includes('greedy')) delta += 0.3;
    if (world.policy.rationing === 'half') delta -= 0.4;
    if (world.policy.rationing === 'starve-soldiers' && (n.role === 'captain' || n.role === 'sergeant')) delta -= 0.8;

    // City-wide hunger upsets everyone
    if (world.population.daysWithoutFood > 0) delta -= 0.8;

    // Rioting in the streets pulls notable loyalty down too
    if (world.population.rioting) delta -= 0.6;

    n.personalLoyalty = clamp(n.personalLoyalty + delta);
  }
}

// Amplifier 1: corrupt merchants hoard grain (feeds starvation loss).
export function disloyalFoodPenalty(world: World): number {
  let penalty = 0;
  for (const n of world.components.notable.map.values()) {
    if (n.role !== 'merchant') continue;
    if (n.personalLoyalty < DISLOYAL_THRESHOLD) penalty += 8;
  }
  return penalty;
}

// Amplifier 2: disloyal officers + nobles drag morale down (feeds revolt loss).
export function disloyalMoralePenalty(world: World): number {
  let penalty = 0;
  for (const n of world.components.notable.map.values()) {
    if (n.personalLoyalty >= DISLOYAL_THRESHOLD) continue;
    if (n.role === 'captain') penalty += 5;
    else if (n.role === 'sergeant') penalty += 2.5;
    else if (n.role === 'noble') penalty += 2;
  }
  return penalty;
}

// Forward-compat for Phase 6: disloyal captain weakens the garrison.
// Returns a multiplier to apply to garrison combat output.
export function garrisonStrengthMultiplier(world: World): number {
  let mult = 1.0;
  for (const n of world.components.notable.map.values()) {
    if (n.role !== 'captain' || n.personalLoyalty >= DISLOYAL_THRESHOLD) continue;
    mult *= 0.7;
  }
  return mult;
}

function hasOperational(world: World, kind: string): boolean {
  for (const b of world.components.building.map.values()) {
    if (b.kind === kind && b.state === 'operational') return true;
  }
  return false;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
