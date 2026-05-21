import type { BuildingKind } from '../ecs/components.ts';
import type { Terrain } from '../world/tilemap.ts';

export interface BuildingOutput {
  resource: 'food' | 'gold' | 'wood' | 'stone';
  perDay: number;
}

export interface BuildingDef {
  kind: BuildingKind;
  label: string;
  cost: { wood: number; stone: number; gold: number };
  buildTicks: number;
  maxHp: number;
  jobs: number;
  validOn: readonly Terrain[];
  blocking: boolean;
  output?: BuildingOutput;        // resources produced when operational
  housing?: number;               // citizens housed
  foodStorage?: number;           // bonus to food stockpile cap
  moraleBonus?: number;           // amenities add to commoner morale baseline
}

// Most urban buildings can be plopped on grass/dirt/road tiles — roads are
// just paving and the player can build over them. Farms are the exception:
// they want fields (grass/farmland/dirt) and don't make sense on a road.
const URBAN: readonly Terrain[] = ['grass', 'dirt', 'road'];

const DEFS: Record<BuildingKind, BuildingDef> = {
  keep:      { kind: 'keep',      label: 'Keep',       cost: { wood: 0,   stone: 0,   gold: 0   }, buildTicks: 0,   maxHp: 1000, jobs: 0, validOn: URBAN, blocking: true,  housing: 0 },
  house:     { kind: 'house',     label: 'House',      cost: { wood: 20,  stone: 0,   gold: 10  }, buildTicks: 200, maxHp: 80,   jobs: 0, validOn: URBAN, blocking: true,  housing: 8 },
  farm:      { kind: 'farm',      label: 'Farm',       cost: { wood: 25,  stone: 0,   gold: 15  }, buildTicks: 250, maxHp: 50,   jobs: 4, validOn: ['grass', 'farmland', 'dirt'], blocking: true, output: { resource: 'food', perDay: 30 } },
  warehouse: { kind: 'warehouse', label: 'Warehouse',  cost: { wood: 40,  stone: 10,  gold: 30  }, buildTicks: 300, maxHp: 120,  jobs: 2, validOn: URBAN, blocking: true, foodStorage: 600 },
  wall:      { kind: 'wall',      label: 'Wall',       cost: { wood: 5,   stone: 25,  gold: 5   }, buildTicks: 150, maxHp: 200,  jobs: 0, validOn: URBAN, blocking: true },
  tower:     { kind: 'tower',     label: 'Tower',      cost: { wood: 15,  stone: 50,  gold: 40  }, buildTicks: 400, maxHp: 300,  jobs: 0, validOn: URBAN, blocking: true },
  gatehouse: { kind: 'gatehouse', label: 'Gatehouse',  cost: { wood: 25,  stone: 60,  gold: 60  }, buildTicks: 450, maxHp: 350,  jobs: 0, validOn: URBAN, blocking: true },
  barracks:  { kind: 'barracks',  label: 'Barracks',   cost: { wood: 30,  stone: 20,  gold: 50  }, buildTicks: 350, maxHp: 150,  jobs: 0, validOn: URBAN, blocking: true },
  tavern:    { kind: 'tavern',    label: 'Tavern',     cost: { wood: 30,  stone: 10,  gold: 40  }, buildTicks: 300, maxHp: 90,   jobs: 2, validOn: URBAN, blocking: true, moraleBonus: 6 },
  chapel:    { kind: 'chapel',    label: 'Chapel',     cost: { wood: 20,  stone: 40,  gold: 60  }, buildTicks: 400, maxHp: 120,  jobs: 1, validOn: URBAN, blocking: true, moraleBonus: 8 },
  market:    { kind: 'market',    label: 'Market',     cost: { wood: 35,  stone: 5,   gold: 80  }, buildTicks: 350, maxHp: 100,  jobs: 3, validOn: URBAN, blocking: true, output: { resource: 'gold', perDay: 10 }, moraleBonus: 3 },
};

export function buildingDef(kind: BuildingKind): BuildingDef {
  return DEFS[kind];
}

export const BUILDABLE_KINDS: BuildingKind[] = [
  'house', 'farm', 'warehouse', 'wall', 'tower', 'gatehouse',
  'barracks', 'tavern', 'chapel', 'market',
];
