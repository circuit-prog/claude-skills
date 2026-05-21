import type { SaveEnvelope } from './serialize.ts';

export const CURRENT_SAVE_VERSION = 1;

type Migrator = (e: SaveEnvelope) => SaveEnvelope;

// Each migrator advances a save from version N to N+1.
// Order matters: keep insertion ascending by version key.
const MIGRATIONS: Record<number, Migrator> = {
  // 0 → 1: no migration; v1 is the first shipped format.
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
