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
  attackCooldown: number;       // ticks until next attack ready
  moveCooldown: number;         // ticks until next move ready
}

export interface Duty {
  kind: DutyKind;
  assignedTo?: EntityId;
  // For 'wall' duty: x/y of the wall tile they're guarding.
  // For 'sally'/'reserve': not used (they path dynamically).
  // For 'watch': x/y of the district they're patrolling.
  postX?: number;
  postY?: number;
}

export type EnemyKind = 'raider' | 'soldier' | 'siege-engine' | 'champion';
export type EnemyFaction = 'raiders' | 'rival-lord' | 'foreign-army';

export interface Enemy {
  kind: EnemyKind;
  faction: EnemyFaction;
  target?: EntityId;
  attackCooldown: number;
  moveCooldown: number;
  // Cached path to target; recomputed when blocked or empty.
  path: Array<{ x: number; y: number }>;
  pathTargetX?: number;
  pathTargetY?: number;
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
