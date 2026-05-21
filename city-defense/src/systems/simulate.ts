import type { World } from '../world/world.ts';
import { advanceTick } from '../engine/time.ts';
import { advanceConstruction } from './construction.ts';
import { produceResourcesTick, consumeFoodDay } from './food.ts';
import { collectTaxesDay } from './economy.ts';
import { updateHomelessDay } from './population.ts';
import { updateMoraleDay, updateRevoltDay } from './morale.ts';
import { evaluateEndConditions } from './victory.ts';

// One simulation tick. The loop calls this at CONFIG.tickMs cadence.
// Per-day systems fire only when the tick rolls the calendar.
export function simulate(world: World): void {
  if (world.gameOver) return;

  const { dayRolled } = advanceTick(world);

  // Per-tick (smooth) systems
  advanceConstruction(world);
  produceResourcesTick(world);

  if (dayRolled) {
    // Order matters: housing → food consumption → economy → morale → revolt → victory.
    updateHomelessDay(world);
    consumeFoodDay(world);
    collectTaxesDay(world);
    updateMoraleDay(world);
    updateRevoltDay(world);
    evaluateEndConditions(world);
  }
}
