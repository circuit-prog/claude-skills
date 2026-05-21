import type { World } from '../world/world.ts';

// Flip the world from preparation to siege when the countdown elapses.
// Idempotent — safe to call every day.
export function maybeStartSiege(world: World): void {
  if (world.phase !== 'preparation') return;
  if (world.daysUntilSiege > 0) return;
  world.phase = 'siege';
}

// Player-triggered early start ("I am ready"). Skips the remaining countdown.
export function forceStartSiege(world: World): void {
  if (world.phase !== 'preparation') return;
  world.daysUntilSiege = 0;
  world.phase = 'siege';
}
