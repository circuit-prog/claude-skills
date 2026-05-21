import type { World } from '../world/world.ts';
import type { DutyKind } from '../ecs/components.ts';
import type { EntityId } from '../ecs/store.ts';
import { each, setComponent } from '../ecs/store.ts';
import { garrisonStrengthMultiplier } from './notables.ts';

export const DUTY_KINDS: readonly DutyKind[] = ['reserve', 'wall', 'gatehouse', 'sally', 'watch'] as const;

export interface DutyCounts {
  reserve: number;
  wall: number;
  gatehouse: number;
  sally: number;
  watch: number;
  total: number;
}

export function countByDuty(world: World): DutyCounts {
  const counts: DutyCounts = { reserve: 0, wall: 0, gatehouse: 0, sally: 0, watch: 0, total: 0 };
  each(world.components.duty, (id, d) => {
    if (!world.components.soldier.map.has(id)) return;
    counts[d.kind] += 1;
    counts.total += 1;
  });
  return counts;
}

// Move `count` soldiers from one duty to another. Used by the duty panel
// (e.g., '+3 wall' takes 3 reserve soldiers and reassigns them).
export function reassignDuties(world: World, from: DutyKind, to: DutyKind, count: number): number {
  if (count <= 0 || from === to) return 0;
  let moved = 0;
  for (const [id, d] of world.components.duty.map) {
    if (moved >= count) break;
    if (d.kind !== from) continue;
    if (!world.components.soldier.map.has(id)) continue;
    setComponent(world.components.duty, id, { kind: to });
    moved += 1;
  }
  return moved;
}

// Night-watch morale bonus. Watch soldiers add a stabilising effect on the
// commoner morale baseline — the bridge between the military system and the
// revolt loss condition. Iron Hand's watchEfficiencyPct multiplies it.
const MORALE_PER_WATCH = 0.4;
const MORALE_CAP = 20;

export function watchMoraleBonus(world: World): number {
  const counts = countByDuty(world);
  const base = counts.watch * MORALE_PER_WATCH;
  const buff = 1 + (world.general.buff.watchEfficiencyPct ?? 0) / 100;
  return Math.min(MORALE_CAP, base * buff);
}

// Soldiers on watch don't fight. Combat effectiveness counts everyone NOT
// on watch (Phase 7 will let mercenary deserters auto-leave).
export function effectiveCombatStrength(world: World): number {
  let s = 0;
  for (const [id, soldier] of world.components.soldier.map) {
    const duty = world.components.duty.map.get(id);
    if (duty?.kind === 'watch') continue;
    void soldier;
    s += 1;
  }
  // Captain loyalty cuts garrison strength.
  return s * garrisonStrengthMultiplier(world);
}

export function findFirstByDuty(world: World, kind: DutyKind): EntityId | null {
  for (const [id, d] of world.components.duty.map) {
    if (d.kind === kind && world.components.soldier.map.has(id)) return id;
  }
  return null;
}
