import type { EntityId } from './store.ts';

export interface Position {
  x: number;
  y: number;
}

export type BuildingKind =
  | 'keep'
  | 'house'
  | 'farm'
  | 'warehouse'
  | 'wall'
  | 'tower'
  | 'gatehouse'
  | 'barracks'
  | 'tavern'
  | 'chapel'
  | 'market';

export type BuildingState = 'planned' | 'building' | 'operational' | 'damaged' | 'ruined';

export interface Building {
  kind: BuildingKind;
  state: BuildingState;
  ticksRemaining: number;
  workersAssigned: number;
}

export interface Health {
  hp: number;
  max: number;
}

export type UnitKind =
  | 'spearman'
  | 'crossbowman'
  | 'men-at-arms'
  | 'knight'
  | 'mercenary'
  | 'peasant-levy';

export type DutyKind = 'reserve' | 'wall' | 'gatehouse' | 'sally' | 'watch';

export interface Soldier {
  unit: UnitKind;
  named: boolean;
  loyalty: number;
}

export interface Duty {
  kind: DutyKind;
  assignedTo?: EntityId;
}

export type EnemyKind = 'raider' | 'soldier' | 'siege-engine' | 'champion';
export type EnemyFaction = 'raiders' | 'rival-lord' | 'foreign-army';

export interface Enemy {
  kind: EnemyKind;
  faction: EnemyFaction;
  target?: EntityId;
}

export type NotableRole =
  | 'captain'
  | 'sergeant'
  | 'noble'
  | 'merchant'
  | 'craftsman'
  | 'advisor';

export type NotableTrait = 'greedy' | 'pious' | 'brave' | 'cowardly' | 'ambitious' | 'loyal' | 'cruel';

export interface Notable {
  name: string;
  role: NotableRole;
  traits: NotableTrait[];
  personalLoyalty: number;
  assignedTo?: EntityId;
}
