import { describe, it, expect } from 'vitest';
import { createWorld } from '../world/world.ts';
import type { SetupChoices } from '../world/world.ts';
import { placeBuilding } from '../systems/construction.ts';
import { toJSON, fromJSON } from './serialize.ts';
import { nextFloat } from '../engine/rng.ts';
import { CONFIG } from '../data/config.ts';

const SETUP: SetupChoices = {
  seed: 12345,
  general: {
    id: 'test',
    name: 'Test General',
    buff: { attackPct: 10 },
  },
  army: {},
};

function makeFreshWorld() {
  return createWorld(SETUP);
}

describe('save/load round-trip', () => {
  it('preserves time, resources, and rng state', () => {
    const a = makeFreshWorld();
    a.tick = 42;
    a.day = 7;
    a.resources.food = 333;
    a.resources.gold = 444;
    nextFloat(a.rng); // advance RNG

    const env = toJSON(a);

    const b = makeFreshWorld();
    fromJSON(JSON.parse(JSON.stringify(env)), b);

    expect(b.tick).toBe(42);
    expect(b.day).toBe(7);
    expect(b.resources.food).toBe(333);
    expect(b.resources.gold).toBe(444);
    expect(b.rng.s).toBe(a.rng.s);
  });

  it('preserves placed buildings and tilemap occupancy', () => {
    const a = makeFreshWorld();
    const kx = Math.floor(CONFIG.mapWidth / 2);
    const ky = Math.floor(CONFIG.mapHeight / 2);
    placeBuilding(a, 'keep', kx, ky, { instant: true, freeOfCost: true });
    placeBuilding(a, 'house', kx + 1, ky, { instant: true, freeOfCost: true });

    const env = toJSON(a);
    const b = makeFreshWorld();
    fromJSON(JSON.parse(JSON.stringify(env)), b);

    expect(b.components.building.map.size).toBe(2);
    const keepId = b.tilemap.buildingAt[ky * b.tilemap.width + kx];
    expect(keepId).not.toBeNull();
    const keep = b.components.building.map.get(keepId as number);
    expect(keep?.kind).toBe('keep');
    expect(keep?.state).toBe('operational');
  });

  it('preserves rng determinism after load', () => {
    const a = makeFreshWorld();
    for (let i = 0; i < 100; i++) nextFloat(a.rng);

    const env = toJSON(a);
    const b = makeFreshWorld();
    fromJSON(JSON.parse(JSON.stringify(env)), b);

    for (let i = 0; i < 20; i++) {
      expect(nextFloat(b.rng)).toBeCloseTo(nextFloat(a.rng), 10);
    }
  });

  it('rejects saves with future version numbers', () => {
    const a = makeFreshWorld();
    const env = toJSON(a);
    env.version = 999;
    const b = makeFreshWorld();
    expect(() => fromJSON(env, b)).toThrow(/newer version/);
  });
});
