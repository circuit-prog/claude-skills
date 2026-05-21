import { describe, it, expect } from 'vitest';
import { createWorld } from '../world/world.ts';
import type { World, SetupChoices } from '../world/world.ts';
import { getGeneral } from '../data/generals.ts';
import {
  maybeFireMilestoneDay, pendingMilestone, dismissPendingMilestone,
  enemyMoraleMultiplier,
} from './milestones.ts';
import { MILESTONES, findMilestone, actFor } from '../data/milestones.ts';
import { simulate } from './simulate.ts';
import { forceStartSiege } from './siege.ts';
import { placeBuilding } from './construction.ts';
import { generateNotables } from '../ecs/notables.ts';
import { toJSON, fromJSON } from '../save/serialize.ts';
import { CONFIG } from '../data/config.ts';

function setup(overrides: Partial<SetupChoices> = {}): SetupChoices {
  return {
    seed: 8,
    general: getGeneral('veteran-knight'),
    army: {},
    ...overrides,
  };
}

function newWorld(overrides: Partial<SetupChoices> = {}): World {
  const w = createWorld(setup(overrides));
  generateNotables(w);
  placeBuilding(w, 'keep', Math.floor(CONFIG.mapWidth / 2), Math.floor(CONFIG.mapHeight / 2),
    { instant: true, freeOfCost: true });
  return w;
}

describe('milestone firing', () => {
  it('fires on the scheduled day and not before', () => {
    const w = newWorld();
    w.day = 14;
    expect(maybeFireMilestoneDay(w)).toBeNull();
    w.day = 15;
    const m = maybeFireMilestoneDay(w);
    expect(m?.id).toBe('half-prep-gone');
    expect(w.firedMilestones).toContain('half-prep-gone');
    expect(w.pendingMilestoneId).toBe('half-prep-gone');
  });

  it('only fires once even when the day is rolled back over', () => {
    const w = newWorld();
    w.day = 15;
    maybeFireMilestoneDay(w);
    dismissPendingMilestone(w);
    // Same day, repeat call — must not refire.
    expect(maybeFireMilestoneDay(w)).toBeNull();
    expect(w.pendingMilestoneId).toBeNull();
  });

  it('triggers apply on fire (Day 60 morale boost)', () => {
    const w = newWorld();
    w.population.morale = 50;
    w.day = 60;
    maybeFireMilestoneDay(w);
    expect(w.population.morale).toBeGreaterThan(50);
  });

  it('Day 175 unlocks relief and weakens enemy wall damage', () => {
    const w = newWorld();
    w.day = 175;
    expect(enemyMoraleMultiplier(w)).toBe(1.0);
    maybeFireMilestoneDay(w);
    expect(w.reliefUnlocked).toBe(true);
    expect(enemyMoraleMultiplier(w)).toBeLessThan(1.0);
  });
});

describe('milestones in the simulate loop', () => {
  it('a scheduled milestone fires on its day rollover', () => {
    // Day-15 milestone fires when the simulation rolls from 14 → 15.
    const w = newWorld();
    forceStartSiege(w);
    // Give the city food so the survival loop can run.
    for (let i = 0; i < 5; i++) {
      placeBuilding(w, 'farm', 60 + i, 20, { instant: true, freeOfCost: true });
    }
    placeBuilding(w, 'warehouse', 35, 30, { instant: true, freeOfCost: true });
    w.day = 14;
    w.tick = 14 * CONFIG.ticksPerGameDay;
    for (let t = 0; t < CONFIG.ticksPerGameDay + 5; t++) simulate(w);
    expect(w.firedMilestones).toContain('half-prep-gone');
  });
});

describe('pendingMilestone + dismiss', () => {
  it('pendingMilestone reads back the right template', () => {
    const w = newWorld();
    w.day = 30;
    maybeFireMilestoneDay(w);
    const m = pendingMilestone(w);
    expect(m?.id).toBe('banners-sighted');
  });

  it('dismiss clears the pending state but keeps the fired record', () => {
    const w = newWorld();
    w.day = 30;
    maybeFireMilestoneDay(w);
    dismissPendingMilestone(w);
    expect(w.pendingMilestoneId).toBeNull();
    expect(w.firedMilestones).toContain('banners-sighted');
  });
});

describe('save round-trip preserves milestone state', () => {
  it('firedMilestones + reliefUnlocked survive serialize/deserialize', () => {
    const a = newWorld();
    a.day = 175;
    maybeFireMilestoneDay(a);
    const env = toJSON(a);

    const b = newWorld();
    fromJSON(JSON.parse(JSON.stringify(env)), b);
    expect(b.firedMilestones).toEqual(a.firedMilestones);
    expect(b.reliefUnlocked).toBe(true);
    expect(b.pendingMilestoneId).toBe('relief-sighted');
  });
});

describe('act labels', () => {
  it('actFor maps days into the three campaign acts', () => {
    expect(actFor(1)).toBe(1);
    expect(actFor(30)).toBe(1);
    expect(actFor(31)).toBe(2);
    expect(actFor(119)).toBe(2);
    expect(actFor(120)).toBe(3);
    expect(actFor(180)).toBe(3);
  });
});

describe('milestone catalogue sanity', () => {
  it('every milestone has unique id, monotonic day, and template lookup', () => {
    const ids = new Set<string>();
    let lastDay = -1;
    for (const m of MILESTONES) {
      expect(ids.has(m.id)).toBe(false);
      ids.add(m.id);
      expect(m.day).toBeGreaterThan(lastDay);
      lastDay = m.day;
      expect(findMilestone(m.id)).toBeDefined();
    }
  });
});
