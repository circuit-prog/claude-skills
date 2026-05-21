import type { EnemyKind, EnemyFaction } from '../ecs/components.ts';

export interface EnemyDef {
  kind: EnemyKind;
  label: string;
  attack: number;
  defence: number;
  hp: number;
  ticksPerStep: number;     // movement speed (lower = faster)
  wallDamage: number;       // attack bonus when hitting walls/buildings
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  raider: {
    kind: 'raider', label: 'Raider',
    attack: 4, defence: 2, hp: 18, ticksPerStep: 9, wallDamage: 2,
  },
  soldier: {
    kind: 'soldier', label: 'Levy Soldier',
    attack: 6, defence: 5, hp: 30, ticksPerStep: 10, wallDamage: 3,
  },
  'siege-engine': {
    kind: 'siege-engine', label: 'Siege Engine',
    attack: 3, defence: 8, hp: 80, ticksPerStep: 18, wallDamage: 18,
  },
  champion: {
    kind: 'champion', label: 'Champion',
    attack: 12, defence: 8, hp: 60, ticksPerStep: 8, wallDamage: 6,
  },
};

export interface Wave {
  day: number;                       // game day when this wave arrives
  faction: EnemyFaction;
  composition: Partial<Record<EnemyKind, number>>;
  edge?: 'north' | 'south' | 'east' | 'west';
}

// Default siege schedule. Designed to escalate through the 180-day campaign.
// Tuned so the first few waves teach the system, then later waves require
// real wall investment + sally tactics.
export const WAVES: Wave[] = [
  // Preparation phase ends day 30; first probe on day 31.
  { day: 31, faction: 'raiders',     composition: { raider: 6 },                                edge: 'north' },
  { day: 45, faction: 'raiders',     composition: { raider: 10 },                               edge: 'east'  },
  { day: 60, faction: 'rival-lord',  composition: { soldier: 8, raider: 4 },                    edge: 'north' },
  { day: 80, faction: 'rival-lord',  composition: { soldier: 14, raider: 6 },                   edge: 'south' },
  { day: 100, faction: 'rival-lord', composition: { soldier: 16, 'siege-engine': 1 },           edge: 'west'  },
  { day: 120, faction: 'foreign-army', composition: { soldier: 20, raider: 8, champion: 1 },    edge: 'north' },
  { day: 145, faction: 'foreign-army', composition: { soldier: 24, 'siege-engine': 2, champion: 2 }, edge: 'east'  },
  { day: 170, faction: 'foreign-army', composition: { soldier: 30, 'siege-engine': 3, champion: 3 }, edge: 'south' },
];
