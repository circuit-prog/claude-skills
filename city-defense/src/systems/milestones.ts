import type { World } from '../world/world.ts';
import type { Milestone } from '../data/milestones.ts';
import { MILESTONES, findMilestone } from '../data/milestones.ts';

// Daily: fire any milestone whose day matches and that hasn't played yet.
// One milestone per day max — if two land on the same day, the second one
// fires on the next day rollover (queue order from MILESTONES).
export function maybeFireMilestoneDay(world: World): Milestone | null {
  for (const m of MILESTONES) {
    if (m.day !== world.day) continue;
    if (world.firedMilestones.includes(m.id)) continue;
    world.firedMilestones.push(m.id);
    world.pendingMilestoneId = m.id;
    applyTriggers(world, m);
    return m;
  }
  return null;
}

function applyTriggers(world: World, m: Milestone): void {
  if (!m.triggers) return;
  if (m.triggers.moraleDelta) {
    world.population.morale = clamp(world.population.morale + m.triggers.moraleDelta);
  }
  if (m.triggers.foodDelta) {
    world.resources.food = Math.max(0, world.resources.food + m.triggers.foodDelta);
  }
  if (m.triggers.forceSiegeStart && world.phase === 'preparation') {
    world.phase = 'siege';
    world.daysUntilSiege = 0;
  }
  if (m.triggers.unlocksRelief) {
    world.reliefUnlocked = true;
  }
}

export function pendingMilestone(world: World): Milestone | null {
  if (!world.pendingMilestoneId) return null;
  return findMilestone(world.pendingMilestoneId) ?? null;
}

export function dismissPendingMilestone(world: World): void {
  world.pendingMilestoneId = null;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

// Multiplier on enemy effectiveness after relief is unlocked. Their morale
// breaks once the king's banners crest the southern horizon — they fight
// at 60% strength for the final 5 days.
export function enemyMoraleMultiplier(world: World): number {
  return world.reliefUnlocked ? 0.6 : 1.0;
}
