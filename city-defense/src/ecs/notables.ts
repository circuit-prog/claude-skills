import type { World } from '../world/world.ts';
import type { NotableRole, NotableTrait, Notable } from './components.ts';
import { allocate, setComponent } from './store.ts';
import {
  GIVEN_MALE, GIVEN_FEMALE, FAMILY, honorific,
  ROLE_TRAIT_WEIGHTS, ALL_TRAITS, TRAIT_CONFLICTS,
} from '../data/notableNames.ts';
import type { RNG } from '../engine/rng.ts';
import { nextFloat, nextInt, pick } from '../engine/rng.ts';

const ROSTER: Record<NotableRole, number> = {
  captain: 1,
  sergeant: 3,
  noble: 4,
  merchant: 3,
  craftsman: 2,
  advisor: 1,
};

// Generate the named individuals for a new world. allyBonus comes from the
// Diplomat's startingNotables buff and adds a guaranteed-loyal noble ally.
export function generateNotables(world: World, allyBonus: number = 0): void {
  for (const [roleStr, count] of Object.entries(ROSTER)) {
    const role = roleStr as NotableRole;
    for (let i = 0; i < count; i++) {
      mintInto(world, role, false);
    }
  }
  for (let i = 0; i < allyBonus; i++) mintInto(world, 'noble', true);
}

function mintInto(world: World, role: NotableRole, isAlly: boolean): void {
  const id = allocate(world.entities);
  const n = mintNotable(world.rng, role, isAlly);
  setComponent(world.components.notable, id, n);
}

function mintNotable(rng: RNG, role: NotableRole, isAlly: boolean): Notable {
  const female = nextFloat(rng) < 0.4;
  const given = pick(rng, female ? GIVEN_FEMALE : GIVEN_MALE);
  const family = pick(rng, FAMILY);
  const name = `${honorific(role, female)} ${given} ${family}`;
  const traits = isAlly ? (['loyal', 'brave'] as NotableTrait[]) : pickTraits(rng, role);
  const loyalty = baseLoyalty(rng, traits, isAlly);
  return { name, role, traits, personalLoyalty: loyalty };
}

function pickTraits(rng: RNG, role: NotableRole): NotableTrait[] {
  const weights = ROLE_TRAIT_WEIGHTS[role];
  const chosen: NotableTrait[] = [];
  // Try up to 12 weighted draws; fall back to uniform if we can't fit a second.
  for (let attempt = 0; attempt < 12 && chosen.length < 2; attempt++) {
    const t = weightedTraitPick(rng, weights);
    if (chosen.includes(t)) continue;
    if (conflictsWith(t, chosen)) continue;
    chosen.push(t);
  }
  // Pad with any non-conflicting uniform pick if we're short.
  while (chosen.length < 2) {
    const t = pick(rng, ALL_TRAITS);
    if (!chosen.includes(t) && !conflictsWith(t, chosen)) chosen.push(t);
  }
  return chosen;
}

function weightedTraitPick(rng: RNG, weights: Partial<Record<NotableTrait, number>>): NotableTrait {
  // All traits have a base weight of 1; the role-specific table multiplies.
  let total = 0;
  for (const t of ALL_TRAITS) total += weights[t] ?? 1;
  const roll = nextFloat(rng) * total;
  let acc = 0;
  for (const t of ALL_TRAITS) {
    acc += weights[t] ?? 1;
    if (roll < acc) return t;
  }
  return ALL_TRAITS[ALL_TRAITS.length - 1]!;
}

function conflictsWith(t: NotableTrait, chosen: readonly NotableTrait[]): boolean {
  for (const c of chosen) {
    for (const [a, b] of TRAIT_CONFLICTS) {
      if ((a === t && b === c) || (b === t && a === c)) return true;
    }
  }
  return false;
}

function baseLoyalty(rng: RNG, traits: readonly NotableTrait[], isAlly: boolean): number {
  if (isAlly) return 95;
  let base = 60 + nextInt(rng, 25); // 60–84
  if (traits.includes('loyal')) base += 10;
  if (traits.includes('ambitious')) base -= 8;
  if (traits.includes('greedy')) base -= 5;
  if (traits.includes('pious')) base += 5;
  if (traits.includes('cruel')) base -= 3;
  return Math.max(20, Math.min(95, base));
}
