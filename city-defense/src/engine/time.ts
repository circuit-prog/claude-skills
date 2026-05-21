import type { World, Season } from '../world/world.ts';
import { CONFIG } from '../data/config.ts';

const SEASONS_ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter'];
const DAYS_PER_SEASON = 30;

export function advanceTick(world: World): { dayRolled: boolean } {
  world.tick += 1;
  if (world.tick % CONFIG.ticksPerGameDay === 0) {
    advanceDay(world);
    return { dayRolled: true };
  }
  return { dayRolled: false };
}

function advanceDay(world: World): void {
  world.day += 1;
  if (world.phase === 'preparation') {
    world.daysUntilSiege = Math.max(0, world.daysUntilSiege - 1);
  }
  const seasonIndex = Math.floor((world.day - 1) / DAYS_PER_SEASON) % SEASONS_ORDER.length;
  world.season = SEASONS_ORDER[seasonIndex]!;
}

export function formatDay(world: World): string {
  return `Day ${world.day} / ${world.daysToSurvive}`;
}
