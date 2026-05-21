import type { Tilemap } from './tilemap.ts';
import { createTilemap } from './tilemap.ts';
import { generateTerrain } from './generation.ts';
import type { RNG } from '../engine/rng.ts';
import { createRng } from '../engine/rng.ts';
import type { ComponentStore, EntityAllocator } from '../ecs/store.ts';
import { createStore, createAllocator } from '../ecs/store.ts';
import type {
  Position, Building, Health, Soldier, Duty, Enemy, Notable,
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
  startingFoodBonus?: number;
  startingGoldBonus?: number;
}

export interface GeneralChoice {
  id: string;
  name: string;
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

export interface SetupChoices {
  seed: number;
  general: GeneralChoice;
  // Starting army composition lands when systems/recruitment.ts arrives.
}

export function createWorld(setup: SetupChoices): World {
  const rng = createRng(setup.seed);
  const tilemap = createTilemap(CONFIG.mapWidth, CONFIG.mapHeight, 'grass');
  generateTerrain(tilemap, rng);

  const startingFood = CONFIG.startingFood + (setup.general.buff.startingFoodBonus ?? 0);
  const startingGold = CONFIG.startingGold + (setup.general.buff.startingGoldBonus ?? 0);

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
      wood: CONFIG.startingWood,
      stone: CONFIG.startingStone,
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
