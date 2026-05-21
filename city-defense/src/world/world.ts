import type { Tilemap } from './tilemap.ts';
import { createTilemap } from './tilemap.ts';
import { generateTerrain } from './generation.ts';
import type { RNG } from '../engine/rng.ts';
import { createRng } from '../engine/rng.ts';
import type { ComponentStore, EntityAllocator } from '../ecs/store.ts';
import { createStore, createAllocator } from '../ecs/store.ts';
import type {
  Position, Building, Health, Soldier, Duty, Enemy, Notable, UnitKind,
} from '../ecs/components.ts';
import { CONFIG } from '../data/config.ts';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Phase = 'preparation' | 'siege';
export type SpeedSetting = 0 | 1 | 2 | 4;

export type Job =
  | 'farmer' | 'builder' | 'soldier' | 'labourer'
  | 'craftsman' | 'merchant' | 'priest' | 'idle';

export interface Resources {
  food: number;
  gold: number;
  wood: number;
  stone: number;
}

export interface PopulationPool {
  total: number;
  byJob: Record<Job, number>;
  homeless: number;
  morale: number;        // 0–100, drives revolt
  starvationDeaths: number;
  daysWithoutFood: number;
  daysInUnrest: number;
  rioting: boolean;
  mercenaryDesertions: number;   // cumulative; UI diffs this for toasts
}

export interface PolicyState {
  taxRate: number;       // %; baseline 10
  rationing: 'normal' | 'half' | 'starve-soldiers';
}

export interface ArmyBuff {
  attackPct?: number;
  defencePct?: number;
  movePct?: number;
  recruitCostPct?: number;
  mercDiscountPct?: number;
  watchEfficiencyPct?: number;
  foodConsumptionPct?: number;       // negative = eats less
  sallySpeedPct?: number;
  upkeepCostPct?: number;
  wallHpPct?: number;
  garrisonStrengthPct?: number;
  startingFoodBonus?: number;
  startingGoldBonus?: number;
  startingWoodBonus?: number;
  startingStoneBonus?: number;
  startingWallSegments?: number;     // pre-placed wall ring radius around keep
  startingNotables?: number;         // extra notable allies
  revoltThresholdDelta?: number;     // adds to revoltThreshold (negative = easier to revolt)
}

export interface GeneralChoice {
  id: string;
  name: string;
  title?: string;
  background?: string;
  buff: ArmyBuff;
  drawback?: ArmyBuff;
}

export interface NotableRequest {
  id: string;
  fromNotableId: number;
  templateId: string;
  description: string;
  deadlineDay: number;
  status: 'pending' | 'accepted' | 'fulfilled' | 'refused' | 'expired';
}

export interface ActiveEvent {
  id: string;
  defId: string;
  startedDay: number;
  expiresDay?: number;
}

export interface GameOver {
  reason: 'captured' | 'starved' | 'revolt' | 'victory';
  day: number;
}

export interface World {
  // Time
  tick: number;
  day: number;
  season: Season;
  phase: Phase;
  daysUntilSiege: number;
  daysToSurvive: number;
  speed: SpeedSetting;

  // RNG
  seed: number;
  rng: RNG;

  // Map
  tilemap: Tilemap;

  // Setup
  general: GeneralChoice;

  // Resources
  resources: Resources;
  population: PopulationPool;
  policy: PolicyState;

  // ECS
  entities: EntityAllocator;
  components: {
    position: ComponentStore<Position>;
    building: ComponentStore<Building>;
    health: ComponentStore<Health>;
    soldier: ComponentStore<Soldier>;
    duty: ComponentStore<Duty>;
    enemy: ComponentStore<Enemy>;
    notable: ComponentStore<Notable>;
  };

  // Queues
  requests: NotableRequest[];
  activeEvents: ActiveEvent[];

  // End state
  gameOver?: GameOver;
}

export type ArmyComposition = Partial<Record<UnitKind, number>>;

export interface SetupChoices {
  seed: number;
  general: GeneralChoice;
  army: ArmyComposition;
}

// Read an ArmyBuff field with both buff and drawback applied. Systems must
// use this — reading world.general.buff directly drops the drawback (e.g.,
// Veteran Knight's +5% recruit cost lives in drawback, so reading .buff
// alone would miss it).
export function effectiveBuff(world: World, key: keyof ArmyBuff): number {
  const a = world.general.buff[key];
  const b = world.general.drawback?.[key];
  return (a ?? 0) + (b ?? 0);
}

export function createWorld(setup: SetupChoices): World {
  const rng = createRng(setup.seed);
  const tilemap = createTilemap(CONFIG.mapWidth, CONFIG.mapHeight, 'grass');
  generateTerrain(tilemap, rng);

  // Apply both buff and drawback to starting resources.
  const fromBuff = (k: keyof ArmyBuff) =>
    (setup.general.buff[k] ?? 0) + (setup.general.drawback?.[k] ?? 0);
  const startingFood = CONFIG.startingFood + fromBuff('startingFoodBonus');
  const startingGold = CONFIG.startingGold + fromBuff('startingGoldBonus');
  const startingWood = CONFIG.startingWood + fromBuff('startingWoodBonus');
  const startingStone = CONFIG.startingStone + fromBuff('startingStoneBonus');

  const world: World = {
    tick: 0,
    day: 1,
    season: 'spring',
    phase: 'preparation',
    daysUntilSiege: CONFIG.daysUntilSiege,
    daysToSurvive: CONFIG.daysToSurvive,
    speed: 1,
    seed: setup.seed,
    rng,
    tilemap,
    general: setup.general,
    resources: {
      food: startingFood,
      gold: startingGold,
      wood: startingWood,
      stone: startingStone,
    },
    population: {
      total: CONFIG.startingPopulation,
      byJob: {
        farmer: 60, builder: 10, soldier: 0, labourer: 20,
        craftsman: 10, merchant: 5, priest: 5, idle: 10,
      },
      homeless: 0,
      morale: 70,
      starvationDeaths: 0,
      daysWithoutFood: 0,
      daysInUnrest: 0,
      rioting: false,
      mercenaryDesertions: 0,
    },
    policy: {
      taxRate: CONFIG.taxBaselineRate,
      rationing: 'normal',
    },
    entities: createAllocator(),
    components: {
      position: createStore<Position>(),
      building: createStore<Building>(),
      health: createStore<Health>(),
      soldier: createStore<Soldier>(),
      duty: createStore<Duty>(),
      enemy: createStore<Enemy>(),
      notable: createStore<Notable>(),
    },
    requests: [],
    activeEvents: [],
  };

  // The Keep sits at the centre of the map. Capturing it is loss condition (1).
  // Terrain under the keep is forced to a buildable tile.
  const keepX = Math.floor(CONFIG.mapWidth / 2);
  const keepY = Math.floor(CONFIG.mapHeight / 2);
  world.tilemap.terrain[keepY * world.tilemap.width + keepX] = 'dirt';
  return world;
}
