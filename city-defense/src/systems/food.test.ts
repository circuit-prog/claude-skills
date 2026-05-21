import { describe, it, expect } from 'vitest';
import { createWorld } from '../world/world.ts';
import type { SetupChoices } from '../world/world.ts';
import { placeBuilding } from './construction.ts';
import { simulate } from './simulate.ts';
import { CONFIG } from '../data/config.ts';

const SETUP: SetupChoices = {
  seed: 1,
  general: { id: 't', name: 'T', buff: {} },
  army: {},
};

function newWorld(seed = 1) {
  return createWorld({ ...SETUP, seed });
}

function runTicks(world: ReturnType<typeof newWorld>, ticks: number) {
  for (let i = 0; i < ticks; i++) {
    simulate(world);
    if (world.gameOver) return;
  }
}

describe('food / starvation loss condition', () => {
  it('runs out of food and triggers the starvation loss', () => {
    const w = newWorld();
    // No farms. ~3-4 days of food, then starvation. Threshold = 25% × 120 = 30.
    runTicks(w, CONFIG.ticksPerGameDay * 60);
    expect(w.gameOver?.reason).toBe('starved');
  });

  it('farms keep food positive and avoid starvation', () => {
    const w = newWorld(2);
    // Place enough farms to feed 120 citizens (~30 food/day each, need 4).
    placeBuilding(w, 'farm', 60, 20, { instant: true, freeOfCost: true });
    placeBuilding(w, 'farm', 61, 20, { instant: true, freeOfCost: true });
    placeBuilding(w, 'farm', 62, 20, { instant: true, freeOfCost: true });
    placeBuilding(w, 'farm', 63, 20, { instant: true, freeOfCost: true });
    placeBuilding(w, 'farm', 64, 20, { instant: true, freeOfCost: true });

    runTicks(w, CONFIG.ticksPerGameDay * 60);
    expect(w.gameOver?.reason).not.toBe('starved');
    expect(w.resources.food).toBeGreaterThan(0);
  });

  it('food cap clamps production at the storage capacity', () => {
    const w = newWorld(3);
    for (let i = 0; i < 10; i++) {
      placeBuilding(w, 'farm', 60 + i, 20, { instant: true, freeOfCost: true });
    }
    // Eat through a few days of overproduction; food shouldn't exceed cap.
    runTicks(w, CONFIG.ticksPerGameDay * 20);
    // Cap = baseFoodStorageCap + 0 warehouses
    expect(w.resources.food).toBeLessThanOrEqual(CONFIG.baseFoodStorageCap + 1);
  });
});
