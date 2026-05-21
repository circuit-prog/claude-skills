import type { World } from '../world/world.ts';
import { CONFIG } from '../data/config.ts';

// Final-pass system: evaluate the three loss conditions and the win condition.
// Runs last each day. Order matters when more than one condition fires the
// same day — we report the most catastrophic one (capture > starve > revolt).
export function evaluateEndConditions(world: World): void {
  if (world.gameOver) return;

  // (1) Capture: enemy occupies the keep, or keep is destroyed.
  // (Wave/AI system will land this in Phase 6; predicate stubbed for now.)
  if (isKeepLost(world)) {
    world.gameOver = { reason: 'captured', day: world.day };
    return;
  }

  // (2) Starvation: cumulative deaths exceed a fraction of starting pop.
  const threshold = CONFIG.startingPopulation * CONFIG.starvationDeathThresholdPct / 100;
  if (world.population.starvationDeaths >= threshold) {
    world.gameOver = { reason: 'starved', day: world.day };
    return;
  }

  // (3) Revolt: morale.ts sets gameOver directly during the riot→surrender
  // arc, so nothing to check here.

  // Win: survived to the deadline.
  if (world.day >= world.daysToSurvive) {
    world.gameOver = { reason: 'victory', day: world.day };
  }
}

function isKeepLost(world: World): boolean {
  let keepId: number | null = null;
  for (const [id, b] of world.components.building.map) {
    if (b.kind === 'keep') { keepId = id; break; }
  }
  if (keepId === null) return false;
  const hp = world.components.health.map.get(keepId);
  return hp ? hp.hp <= 0 : false;
}
