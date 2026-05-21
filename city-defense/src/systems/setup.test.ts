import { describe, it, expect } from 'vitest';
import { createWorld } from '../world/world.ts';
import type { SetupChoices } from '../world/world.ts';
import { GENERALS, getGeneral } from '../data/generals.ts';
import { spawnStartingArmy, armyGoldCost, armyDailyFoodCost } from './recruitment.ts';
import { placeBuilding, placeStartingWalls } from './construction.ts';
import { daysOfFoodRemaining } from './food.ts';
import { simulate } from './simulate.ts';
import { CONFIG } from '../data/config.ts';

function setup(overrides: Partial<SetupChoices>): SetupChoices {
  return {
    seed: 1,
    general: GENERALS[0]!,
    army: {},
    ...overrides,
  };
}

describe('general buffs', () => {
  it('Quartermaster reduces daily food burn vs the Veteran Knight', () => {
    const army = { spearman: 10 };
    const knight = createWorld(setup({ general: getGeneral('veteran-knight'), army }));
    spawnStartingArmy(knight, army);
    const quartermaster = createWorld(setup({ general: getGeneral('quartermaster'), army }));
    spawnStartingArmy(quartermaster, army);

    expect(daysOfFoodRemaining(quartermaster)).toBeGreaterThan(daysOfFoodRemaining(knight));
  });

  it('Quartermaster starts with bonus food and gold', () => {
    const w = createWorld(setup({ general: getGeneral('quartermaster') }));
    expect(w.resources.food).toBe(CONFIG.startingFood + 250);
    expect(w.resources.gold).toBe(CONFIG.startingGold + 50);
  });

  it('Wall Engineer pre-places the requested wall segments', () => {
    const general = getGeneral('wall-engineer');
    const w = createWorld(setup({ general }));
    placeStartingWalls(w, general.buff.startingWallSegments ?? 0);

    let walls = 0;
    for (const b of w.components.building.map.values()) {
      if (b.kind === 'wall') walls += 1;
    }
    expect(walls).toBe(general.buff.startingWallSegments);
  });

  it('Iron Hand raises the revolt floor (loses earlier)', () => {
    // Run identical bad-policy games with plenty of food, so morale
    // is the only failing axis. Iron Hand should hit revolt on an
    // earlier day or the same day.
    function makeRevoltRun(generalId: string) {
      const w = createWorld(setup({ general: getGeneral(generalId), army: {} }));
      w.policy.taxRate = 30;
      for (let i = 0; i < 8; i++) {
        placeBuilding(w, 'farm', 30 + i, 30, { instant: true, freeOfCost: true });
      }
      placeBuilding(w, 'warehouse', 30, 31, { instant: true, freeOfCost: true });
      return w;
    }
    const baseline = makeRevoltRun('veteran-knight');
    const iron = makeRevoltRun('iron-hand');

    for (let t = 0; t < CONFIG.ticksPerGameDay * 200; t++) {
      if (baseline.gameOver && iron.gameOver) break;
      if (!baseline.gameOver) simulate(baseline);
      if (!iron.gameOver) simulate(iron);
    }
    expect(iron.gameOver?.reason).toBe('revolt');
    expect(baseline.gameOver?.reason).toBe('revolt');
    if (iron.gameOver && baseline.gameOver) {
      expect(iron.gameOver.day).toBeLessThanOrEqual(baseline.gameOver.day);
    }
  });
});

describe('starting army composition', () => {
  it('spawns the requested soldier counts', () => {
    const army = { spearman: 8, crossbowman: 4, 'men-at-arms': 2 } as const;
    const w = createWorld(setup({ army }));
    spawnStartingArmy(w, army);
    expect(w.components.soldier.map.size).toBe(14);
  });

  it('computes the gold cost from unit definitions', () => {
    expect(armyGoldCost({ spearman: 1 })).toBeGreaterThan(0);
    expect(armyGoldCost({ knight: 2 })).toBeGreaterThan(armyGoldCost({ spearman: 2 }));
  });

  it('larger armies eat more food per day', () => {
    expect(armyDailyFoodCost({ spearman: 10 }))
      .toBeGreaterThan(armyDailyFoodCost({ spearman: 5 }));
  });
});
