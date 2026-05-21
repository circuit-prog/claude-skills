import { describe, it, expect } from 'vitest';
import { createWorld } from '../world/world.ts';
import type { World, SetupChoices } from '../world/world.ts';
import { getGeneral } from '../data/generals.ts';
import { placeBuilding } from './construction.ts';
import { spawnStartingArmy } from './recruitment.ts';
import { generateNotables } from '../ecs/notables.ts';
import { advanceEnemiesTick, totalEnemies, spawnWavesDay } from './enemy.ts';
import { advanceSoldiersTick } from './military.ts';
import { simulate } from './simulate.ts';
import { reassignDuties, watchMoraleBonus, countByDuty } from './duties.ts';
import { computeMoraleTarget } from './morale.ts';
import { allocate, setComponent } from '../ecs/store.ts';
import { ENEMIES } from '../data/enemies.ts';
import { CONFIG } from '../data/config.ts';
import { forceStartSiege } from './siege.ts';

function setup(overrides: Partial<SetupChoices> = {}): SetupChoices {
  return {
    seed: 3,
    general: getGeneral('veteran-knight'),
    army: {},
    ...overrides,
  };
}

function newWorld(overrides: Partial<SetupChoices> = {}): World {
  const w = createWorld(setup(overrides));
  // Place keep at centre — main.ts normally does this; tests need it too
  // since simulate references the keep entity.
  placeBuilding(w, 'keep', Math.floor(CONFIG.mapWidth / 2), Math.floor(CONFIG.mapHeight / 2),
    { instant: true, freeOfCost: true });
  generateNotables(w);
  return w;
}

// Spawn an enemy at a precise position for deterministic combat tests.
function spawnEnemy(world: World, x: number, y: number, kind: 'raider' | 'soldier' | 'champion' = 'raider'): number {
  const id = allocate(world.entities);
  const def = ENEMIES[kind];
  setComponent(world.components.position, id, { x, y });
  setComponent(world.components.health, id, { hp: def.hp, max: def.hp });
  setComponent(world.components.enemy, id, {
    kind, faction: 'raiders',
    attackCooldown: 0, moveCooldown: 0, path: [],
  });
  return id;
}

describe('combat resolution', () => {
  it('a soldier kills an adjacent raider given enough ticks', () => {
    const w = newWorld({ army: { 'men-at-arms': 2 } });
    spawnStartingArmy(w, { 'men-at-arms': 2 });
    // Spawn enemy next to the keep position where soldiers spiral out.
    const keepX = Math.floor(CONFIG.mapWidth / 2);
    const keepY = Math.floor(CONFIG.mapHeight / 2);
    spawnEnemy(w, keepX + 1, keepY + 1);
    const startCount = totalEnemies(w);
    expect(startCount).toBe(1);

    for (let t = 0; t < 200; t++) {
      advanceSoldiersTick(w);
      advanceEnemiesTick(w);
      if (totalEnemies(w) === 0) break;
    }
    expect(totalEnemies(w)).toBe(0);
  });

  it('an unopposed enemy eventually destroys the keep (capture loss)', () => {
    const w = newWorld({ army: {} });
    forceStartSiege(w);
    const keepX = Math.floor(CONFIG.mapWidth / 2);
    const keepY = Math.floor(CONFIG.mapHeight / 2);
    // Spawn three siege engines next to the keep — punch through fast.
    spawnEnemy(w, keepX + 1, keepY, 'champion');
    spawnEnemy(w, keepX - 1, keepY, 'champion');
    spawnEnemy(w, keepX, keepY + 1, 'champion');

    for (let t = 0; t < CONFIG.ticksPerGameDay * 30; t++) {
      simulate(w);
      if (w.gameOver) break;
    }
    expect(w.gameOver?.reason).toBe('captured');
  });
});

describe('night watch morale', () => {
  it('soldiers on watch raise the morale target', () => {
    const w = newWorld({ army: { spearman: 6 } });
    spawnStartingArmy(w, { spearman: 6 });

    const before = computeMoraleTarget(w).total;
    expect(countByDuty(w).watch).toBe(0);

    const moved = reassignDuties(w, 'reserve', 'watch', 6);
    expect(moved).toBe(6);

    const bonus = watchMoraleBonus(w);
    expect(bonus).toBeGreaterThan(0);

    const after = computeMoraleTarget(w).total;
    expect(after).toBeGreaterThan(before);
  });

  it('Iron Hand watchEfficiencyPct boosts the watch bonus', () => {
    const baseline = newWorld({ general: getGeneral('veteran-knight'), army: { spearman: 4 } });
    spawnStartingArmy(baseline, { spearman: 4 });
    reassignDuties(baseline, 'reserve', 'watch', 4);

    const iron = newWorld({ general: getGeneral('iron-hand'), army: { spearman: 4 } });
    spawnStartingArmy(iron, { spearman: 4 });
    reassignDuties(iron, 'reserve', 'watch', 4);

    expect(watchMoraleBonus(iron)).toBeGreaterThan(watchMoraleBonus(baseline));
  });
});

describe('duty assignment', () => {
  it('reassignDuties moves the requested count', () => {
    const w = newWorld({ army: { spearman: 8 } });
    spawnStartingArmy(w, { spearman: 8 });
    expect(countByDuty(w).reserve).toBe(8);
    const moved = reassignDuties(w, 'reserve', 'wall', 3);
    expect(moved).toBe(3);
    expect(countByDuty(w).reserve).toBe(5);
    expect(countByDuty(w).wall).toBe(3);
  });

  it('cannot move more soldiers than exist on the source duty', () => {
    const w = newWorld({ army: { spearman: 2 } });
    spawnStartingArmy(w, { spearman: 2 });
    const moved = reassignDuties(w, 'reserve', 'wall', 99);
    expect(moved).toBe(2);
    expect(countByDuty(w).reserve).toBe(0);
  });
});

describe('wave spawning + siege phase', () => {
  it('preparation phase blocks waves even on a scheduled day', () => {
    const w = newWorld();
    // Jump straight to a known wave day without flipping the phase.
    w.day = 31;
    spawnWavesDay(w);
    expect(totalEnemies(w)).toBe(0);
  });

  it('siege phase spawns the scheduled wave', () => {
    const w = newWorld();
    forceStartSiege(w);
    w.day = 31;
    spawnWavesDay(w);
    // First wave is 6 raiders.
    expect(totalEnemies(w)).toBe(6);
  });

  it('forceStartSiege flips the phase immediately', () => {
    const w = newWorld();
    expect(w.phase).toBe('preparation');
    forceStartSiege(w);
    expect(w.phase).toBe('siege');
    expect(w.daysUntilSiege).toBe(0);
  });
});

describe('walls protect the keep', () => {
  it('a complete wall ring delays the capture loss', () => {
    function run(buildWalls: boolean) {
      const w = newWorld({ army: {} });
      forceStartSiege(w);
      const cx = Math.floor(CONFIG.mapWidth / 2);
      const cy = Math.floor(CONFIG.mapHeight / 2);
      if (buildWalls) {
        // Square wall ring two tiles out from the keep.
        for (let i = -2; i <= 2; i++) {
          placeBuilding(w, 'wall', cx + i, cy - 2, { instant: true, freeOfCost: true });
          placeBuilding(w, 'wall', cx + i, cy + 2, { instant: true, freeOfCost: true });
          placeBuilding(w, 'wall', cx - 2, cy + i, { instant: true, freeOfCost: true });
          placeBuilding(w, 'wall', cx + 2, cy + i, { instant: true, freeOfCost: true });
        }
      }
      for (let i = 0; i < 8; i++) spawnEnemy(w, cx + 6 + i, cy, 'raider');
      let day = 0;
      for (let t = 0; t < CONFIG.ticksPerGameDay * 60; t++) {
        simulate(w);
        if (w.gameOver) { day = w.day; break; }
      }
      return { day, reason: w.gameOver?.reason };
    }
    const walled = run(true);
    const naked = run(false);
    // Either walled survives longer, or naked falls and walled doesn't.
    if (walled.reason && naked.reason) {
      expect(walled.day).toBeGreaterThanOrEqual(naked.day);
    } else {
      expect(naked.reason).toBeDefined();
    }
  });
});
