import type { SaveEnvelope } from './serialize.ts';

export const CURRENT_SAVE_VERSION = 3;

type Migrator = (e: SaveEnvelope) => SaveEnvelope;

// Each migrator advances a save from version N to N+1.
// Order matters: keep insertion ascending by version key.
const MIGRATIONS: Record<number, Migrator> = {
  // 1 → 2: introduced PolicyState (tax rate + rationing) and revolt fields
  // (daysInUnrest, rioting) on the population pool.
  1: (env) => {
    const w = env.world as unknown as Record<string, unknown>;
    if (!w['policy']) {
      w['policy'] = { taxRate: 10, rationing: 'normal' };
    }
    const pop = w['population'] as Record<string, unknown> | undefined;
    if (pop) {
      if (pop['daysInUnrest'] === undefined) pop['daysInUnrest'] = 0;
      if (pop['rioting'] === undefined) pop['rioting'] = false;
    }
    return env;
  },
  // 2 → 3: Phase 6 added cooldown + path fields on Soldier and Enemy
  // components. Backfill defaults so older saves still load and animate.
  2: (env) => {
    const w = env.world as unknown as { components?: Record<string, Array<[number, Record<string, unknown>]>> };
    const comps = w.components;
    if (comps) {
      for (const [, s] of comps['soldier'] ?? []) {
        if (s['attackCooldown'] === undefined) s['attackCooldown'] = 0;
        if (s['moveCooldown'] === undefined) s['moveCooldown'] = 0;
      }
      for (const [, e] of comps['enemy'] ?? []) {
        if (e['attackCooldown'] === undefined) e['attackCooldown'] = 0;
        if (e['moveCooldown'] === undefined) e['moveCooldown'] = 0;
        if (!Array.isArray(e['path'])) e['path'] = [];
      }
    }
    return env;
  },
};

export function migrate(env: SaveEnvelope): SaveEnvelope {
  if (typeof env.version !== 'number') throw new Error('save: missing version');
  if (env.version > CURRENT_SAVE_VERSION) {
    throw new Error(`save is from a newer version (${env.version} > ${CURRENT_SAVE_VERSION})`);
  }
  let cur = env;
  while (cur.version < CURRENT_SAVE_VERSION) {
    const next = MIGRATIONS[cur.version];
    if (!next) throw new Error(`save: no migrator for v${cur.version}`);
    cur = next(cur);
    cur.version += 1;
  }
  return cur;
}
