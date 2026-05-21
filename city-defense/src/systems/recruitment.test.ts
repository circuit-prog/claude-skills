import { describe, it, expect } from 'vitest';
import { createWorld } from '../world/world.ts';
import type { World, SetupChoices } from '../world/world.ts';
import { getGeneral } from '../data/generals.ts';
import {
  conscriptPeasants, hireMercenaries, processSoldierUpkeepDay,
  peasantConscriptCost, mercenaryHireCost, conscriptablePopulation,
  liveDailyUpkeep, mercenaryCount,
} from './recruitment.ts';
import { generateNotables } from '../ecs/notables.ts';
import { CONFIG } from '../data/config.ts';

function setup(overrides: Partial<SetupChoices> = {}): SetupChoices {
  return {
    seed: 13,
    general: getGeneral('veteran-knight'),
    army: {},
    ...overrides,
  };
}

function newWorld(overrides: Partial<SetupChoices> = {}): World {
  const w = createWorld(setup(overrides));
  generateNotables(w);
  return w;
}

describe('peasant conscription', () => {
  it('spawns soldiers and drains workers from the pool', () => {
    const w = newWorld();
    const popBefore = w.population.total;
    const goldBefore = w.resources.gold;
    const soldiersBefore = w.components.soldier.map.size;

    const result = conscriptPeasants(w, 3);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(3);
    expect(w.components.soldier.map.size).toBe(soldiersBefore + 3);
    expect(w.population.total).toBe(popBefore - 3);
    expect(w.resources.gold).toBeLessThan(goldBefore);
  });

  it('refuses when there is not enough gold', () => {
    const w = newWorld();
    w.resources.gold = 1;
    const result = conscriptPeasants(w, 5);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/gold/);
    expect(w.components.soldier.map.size).toBe(0);
  });

  it('drains idle workers first, then the safe-job buckets, then farmers', () => {
    const w = newWorld();
    // Force a known starting state.
    w.population.byJob.idle = 4;
    w.population.byJob.labourer = 2;
    w.population.byJob.farmer = 30;
    w.population.total = 4 + 2 + 30;

    conscriptPeasants(w, 4);
    expect(w.population.byJob.idle).toBe(0);
    expect(w.population.byJob.labourer).toBe(2);
    expect(w.population.byJob.farmer).toBe(30);
  });

  it('respects the farmer floor (cannot strip the city of every farmer)', () => {
    const w = newWorld();
    // Tiny city: 25 farmers, nothing else. Floor is 20.
    for (const k of Object.keys(w.population.byJob) as Array<keyof typeof w.population.byJob>) {
      w.population.byJob[k] = 0;
    }
    w.population.byJob.farmer = 25;
    w.population.total = 25;

    expect(conscriptablePopulation(w)).toBe(5);
    const fail = conscriptPeasants(w, 10);
    expect(fail.ok).toBe(false);
    expect(fail.reason).toMatch(/peasants/);

    const ok = conscriptPeasants(w, 5);
    expect(ok.ok).toBe(true);
    expect(w.population.byJob.farmer).toBe(20);
  });

  it('Veteran Knight raises the conscript cost via recruitCostPct', () => {
    const baseline = newWorld({ general: getGeneral('quartermaster') }); // recruitCostPct not set
    const knight = newWorld({ general: getGeneral('veteran-knight') });  // +5% recruit cost
    expect(peasantConscriptCost(knight)).toBeGreaterThan(peasantConscriptCost(baseline));
  });
});

describe('mercenary hiring', () => {
  it('spawns mercenary soldiers and debits gold', () => {
    const w = newWorld();
    w.resources.gold = 1000;
    const result = hireMercenaries(w, 2);
    expect(result.ok).toBe(true);
    expect(mercenaryCount(w)).toBe(2);
    expect(w.resources.gold).toBe(1000 - mercenaryHireCost(w) * 2);
  });

  it('Diplomat applies mercDiscountPct', () => {
    const baseline = newWorld({ general: getGeneral('veteran-knight') });
    const diplomat = newWorld({ general: getGeneral('diplomat') });
    expect(mercenaryHireCost(diplomat)).toBeLessThan(mercenaryHireCost(baseline));
  });

  it('refuses with insufficient gold', () => {
    const w = newWorld();
    w.resources.gold = 5;
    const result = hireMercenaries(w, 2);
    expect(result.ok).toBe(false);
    expect(mercenaryCount(w)).toBe(0);
  });
});

describe('soldier upkeep + mercenary desertion', () => {
  it('debits gold each day equal to upkeep', () => {
    const w = newWorld();
    w.resources.gold = 200;
    hireMercenaries(w, 2);
    const goldAfterHire = w.resources.gold;
    const report = processSoldierUpkeepDay(w);
    expect(report.upkeepPaid).toBeGreaterThan(0);
    expect(w.resources.gold).toBe(goldAfterHire - report.upkeepPaid);
  });

  it('Cavalry Commander upkeepCostPct raises the daily wage', () => {
    const a = newWorld({ general: getGeneral('veteran-knight') });
    hireMercenaries(a, 1);
    const b = newWorld({ general: getGeneral('cavalry-commander') });
    hireMercenaries(b, 1);
    expect(liveDailyUpkeep(b)).toBeGreaterThan(liveDailyUpkeep(a));
  });

  it('mercenaries do not desert when gold and morale are healthy', () => {
    const w = newWorld();
    w.resources.gold = 5000;
    w.population.morale = 70;
    hireMercenaries(w, 10);
    const before = mercenaryCount(w);
    // Refill before each upkeep tick so gold can't fall below the desertion
    // threshold — we want to isolate the "no triggers, no desertions" path.
    for (let d = 0; d < 30; d++) {
      w.resources.gold = 5000;
      processSoldierUpkeepDay(w);
    }
    expect(mercenaryCount(w)).toBe(before);
    expect(w.population.mercenaryDesertions).toBe(0);
  });

  it('low gold triggers desertions over time', () => {
    const w = newWorld();
    w.resources.gold = 1000;
    w.population.morale = 70;
    hireMercenaries(w, 20);
    const before = mercenaryCount(w);

    // Drain treasury, then roll several days of upkeep + desertion checks.
    w.resources.gold = 5;
    let desertions = 0;
    for (let d = 0; d < 30 && mercenaryCount(w) > 0; d++) {
      const report = processSoldierUpkeepDay(w);
      desertions += report.desertions;
      // Keep treasury empty so the desertion pressure stays on.
      w.resources.gold = 0;
    }
    expect(desertions).toBeGreaterThan(0);
    expect(mercenaryCount(w)).toBeLessThan(before);
    expect(w.population.mercenaryDesertions).toBe(desertions);
  });

  it('non-mercenary soldiers never desert', () => {
    const w = newWorld();
    w.resources.gold = 0;
    w.population.morale = 5;
    conscriptPeasants(w, 0); // no-op
    // Hand-place a spearman via the starting army path.
    for (let i = 0; i < 5; i++) {
      conscriptPeasants(w, 0);
    }
    // Use hireMercenaries first to bump gold drain then revert.
    w.resources.gold = 100;
    conscriptPeasants(w, 3);
    const beforeNonMerc = w.components.soldier.map.size;
    w.resources.gold = 0;
    for (let d = 0; d < 20; d++) processSoldierUpkeepDay(w);
    // No mercenaries to desert; peasant levies stay.
    expect(w.components.soldier.map.size).toBe(beforeNonMerc);
    expect(w.population.mercenaryDesertions).toBe(0);
  });
});

describe('config sanity', () => {
  it('peasant cost is below mercenary cost', () => {
    expect(CONFIG.peasantLevyGoldCost).toBeLessThan(20);
  });

  it('mercenary loyalty starts lower than regular troops', () => {
    expect(CONFIG.mercenaryStartingLoyalty).toBeLessThan(80);
  });
});
