import type { World } from '../world/world.ts';
import { advanceTick } from '../engine/time.ts';
import { advanceConstruction } from './construction.ts';
import { produceResourcesTick, consumeFoodDay } from './food.ts';
import { collectTaxesDay } from './economy.ts';
import { updateHomelessDay } from './population.ts';
import { updateNotablesDay } from './notables.ts';
import { advanceRequestsDay } from './requests.ts';
import { updateMoraleDay, updateRevoltDay } from './morale.ts';
import { maybeStartSiege } from './siege.ts';
import { spawnWavesDay, advanceEnemiesTick } from './enemy.ts';
import { advanceSoldiersTick } from './military.ts';
import { evaluateEndConditions } from './victory.ts';

// One simulation tick. The loop calls this at CONFIG.tickMs cadence.
// Per-day systems fire only when the tick rolls the calendar.
export function simulate(world: World): void {
  if (world.gameOver) return;

  const { dayRolled } = advanceTick(world);

  // Per-tick (smooth) systems
  advanceConstruction(world);
  produceResourcesTick(world);
  advanceEnemiesTick(world);
  advanceSoldiersTick(world);

  if (dayRolled) {
    // Order: siege phase flip → wave spawn → housing → food → economy →
    // notables (loyalty drift + amplifiers) → requests (so morale/loyalty
    // changes from request fulfilment land in the same day's morale
    // recompute) → morale → revolt → victory.
    maybeStartSiege(world);
    spawnWavesDay(world);
    updateHomelessDay(world);
    consumeFoodDay(world);
    collectTaxesDay(world);
    updateNotablesDay(world);
    advanceRequestsDay(world);
    updateMoraleDay(world);
    updateRevoltDay(world);
    evaluateEndConditions(world);
  }
}
