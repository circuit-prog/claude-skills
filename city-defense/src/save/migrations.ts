import type { SaveEnvelope } from './serialize.ts';

export const CURRENT_SAVE_VERSION = 2;

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
