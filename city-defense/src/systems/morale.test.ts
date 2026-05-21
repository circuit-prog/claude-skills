import { describe, it, expect } from 'vitest';
import { createWorld } from '../world/world.ts';
import type { SetupChoices } from '../world/world.ts';
import { placeBuilding } from './construction.ts';
import { simulate } from './simulate.ts';
import { computeMoraleTarget } from './morale.ts';
import { CONFIG } from '../data/config.ts';

const SETUP: SetupChoices = {
  seed: 1,
  general: { id: 't', name: 'T', buff: {} },
  army: {},
};

function newWorld(seed = 1) {
  return createWorld({ ...SETUP, seed });
}

describe('morale + revolt loss condition', () => {
  it('high taxes drag morale below baseline', () => {
    const a = newWorld(10);
    a.policy.taxRate = 10;
    const moraleAt10 = computeMoraleTarget(a).total;

    const b = newWorld(10);
    b.policy.taxRate = 25;
    const moraleAt25 = computeMoraleTarget(b).total;

    expect(moraleAt25).toBeLessThan(moraleAt10);
  });

  it('amenities raise morale baseline', () => {
    const a = newWorld(11);
    const before = computeMoraleTarget(a).total;
    placeBuilding(a, 'tavern', 20, 20, { instant: true, freeOfCost: true });
    placeBuilding(a, 'chapel', 21, 20, { instant: true, freeOfCost: true });
    const after = computeMoraleTarget(a).total;
    expect(after).toBeGreaterThan(before);
  });

  it('max-tax + no farms triggers a riot, then a revolt loss', () => {
    const w = newWorld(12);
    w.policy.taxRate = 30;
    // Feed them enough to NOT die from starvation first — give them lots
    // of farms but a brutal tax burden.
    for (let i = 0; i < 8; i++) {
      placeBuilding(w, 'farm', 30 + i, 30, { instant: true, freeOfCost: true });
    }
    for (let t = 0; t < CONFIG.ticksPerGameDay * 80; t++) {
      simulate(w);
      if (w.gameOver) break;
    }
    expect(w.gameOver?.reason).toBe('revolt');
  });

  it('reasonable policy + farms wins the game', () => {
    const w = newWorld(13);
    w.policy.taxRate = 8;
    // Plenty of food, a tavern for morale, and a survivable schedule.
    for (let i = 0; i < 6; i++) {
      placeBuilding(w, 'farm', 30 + i, 30, { instant: true, freeOfCost: true });
    }
    // Warehouses to stockpile through winter (cap raises by 600 each).
    placeBuilding(w, 'warehouse', 36, 30, { instant: true, freeOfCost: true });
    placeBuilding(w, 'warehouse', 37, 30, { instant: true, freeOfCost: true });
    placeBuilding(w, 'tavern', 30, 31, { instant: true, freeOfCost: true });
    placeBuilding(w, 'chapel', 31, 31, { instant: true, freeOfCost: true });
    // Houses so the pop isn't homeless.
    for (let i = 0; i < 10; i++) {
      placeBuilding(w, 'house', 30 + i, 32, { instant: true, freeOfCost: true });
    }
    for (let t = 0; t < CONFIG.ticksPerGameDay * (CONFIG.daysToSurvive + 5); t++) {
      simulate(w);
      if (w.gameOver) break;
    }
    expect(w.gameOver?.reason).toBe('victory');
  });
});
