import type { World } from '../world/world.ts';
import type { ComponentStore } from '../ecs/store.ts';
import { migrate, CURRENT_SAVE_VERSION } from './migrations.ts';

export interface SaveEnvelope {
  version: number;
  savedAt: number;        // unix ms
  world: SerializedWorld;
}

interface SerializedWorld {
  tick: number;
  day: number;
  season: World['season'];
  phase: World['phase'];
  daysUntilSiege: number;
  daysToSurvive: number;
  speed: World['speed'];
  seed: number;
  rngState: number;

  tilemap: {
    width: number;
    height: number;
    terrain: World['tilemap']['terrain'];
    buildingAt: World['tilemap']['buildingAt'];
  };

  general: World['general'];
  resources: World['resources'];
  population: World['population'];
  policy: World['policy'];

  nextEntityId: number;
  components: Record<keyof World['components'], Array<[number, unknown]>>;

  requests: World['requests'];
  activeEvents: World['activeEvents'];
  firedMilestones: string[];
  pendingMilestoneId: string | null;
  reliefUnlocked: boolean;
  gameOver?: World['gameOver'];
}

export function toJSON(world: World): SaveEnvelope {
  return {
    version: CURRENT_SAVE_VERSION,
    savedAt: Date.now(),
    world: serialize(world),
  };
}

export function fromJSON(envelope: unknown, current: World): World {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('save: not an object');
  }
  const e = envelope as SaveEnvelope;
  const migrated = migrate(e);
  return deserialize(migrated.world, current);
}

function serialize(w: World): SerializedWorld {
  return {
    tick: w.tick,
    day: w.day,
    season: w.season,
    phase: w.phase,
    daysUntilSiege: w.daysUntilSiege,
    daysToSurvive: w.daysToSurvive,
    speed: w.speed,
    seed: w.seed,
    rngState: w.rng.s,

    tilemap: {
      width: w.tilemap.width,
      height: w.tilemap.height,
      terrain: [...w.tilemap.terrain],
      buildingAt: [...w.tilemap.buildingAt],
    },

    general: w.general,
    resources: { ...w.resources },
    population: { ...w.population, byJob: { ...w.population.byJob } },
    policy: { ...w.policy },

    nextEntityId: w.entities.next,
    components: {
      position: storeToArray(w.components.position),
      building: storeToArray(w.components.building),
      health: storeToArray(w.components.health),
      soldier: storeToArray(w.components.soldier),
      duty: storeToArray(w.components.duty),
      enemy: storeToArray(w.components.enemy),
      notable: storeToArray(w.components.notable),
    },

    requests: w.requests.map((r) => ({ ...r })),
    activeEvents: w.activeEvents.map((e) => ({ ...e })),
    firedMilestones: [...w.firedMilestones],
    pendingMilestoneId: w.pendingMilestoneId,
    reliefUnlocked: w.reliefUnlocked,
    ...(w.gameOver ? { gameOver: { ...w.gameOver } } : {}),
  };
}

function deserialize(s: SerializedWorld, target: World): World {
  target.tick = s.tick;
  target.day = s.day;
  target.season = s.season;
  target.phase = s.phase;
  target.daysUntilSiege = s.daysUntilSiege;
  target.daysToSurvive = s.daysToSurvive;
  target.speed = s.speed;
  target.seed = s.seed;
  target.rng.s = s.rngState;

  target.tilemap.width = s.tilemap.width;
  target.tilemap.height = s.tilemap.height;
  target.tilemap.terrain = [...s.tilemap.terrain];
  target.tilemap.buildingAt = [...s.tilemap.buildingAt];

  target.general = s.general;
  target.resources = { ...s.resources };
  target.population = { ...s.population, byJob: { ...s.population.byJob } };
  target.policy = { ...s.policy };

  target.entities.next = s.nextEntityId;

  arrayToStore(target.components.position, s.components.position);
  arrayToStore(target.components.building, s.components.building);
  arrayToStore(target.components.health, s.components.health);
  arrayToStore(target.components.soldier, s.components.soldier);
  arrayToStore(target.components.duty, s.components.duty);
  arrayToStore(target.components.enemy, s.components.enemy);
  arrayToStore(target.components.notable, s.components.notable);

  target.requests = s.requests.map((r) => ({ ...r }));
  target.activeEvents = s.activeEvents.map((e) => ({ ...e }));
  target.firedMilestones = [...s.firedMilestones];
  target.pendingMilestoneId = s.pendingMilestoneId;
  target.reliefUnlocked = s.reliefUnlocked;
  if (s.gameOver) target.gameOver = { ...s.gameOver };
  else delete target.gameOver;
  return target;
}

function storeToArray<T>(s: ComponentStore<T>): Array<[number, T]> {
  return [...s.map.entries()];
}

function arrayToStore<T>(target: ComponentStore<T>, entries: Array<[number, unknown]>): void {
  target.map.clear();
  for (const [id, c] of entries) target.map.set(id, c as T);
}
