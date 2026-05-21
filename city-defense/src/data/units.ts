import type { UnitKind } from '../ecs/components.ts';

export interface UnitDef {
  kind: UnitKind;
  label: string;
  blurb: string;
  goldCost: number;            // recruitment cost
  upkeepGoldPerDay: number;    // ongoing gold drain
  foodPerDay: number;          // overrides config soldier rate per type
  attack: number;
  defence: number;
  ranged: boolean;
  hp: number;                  // base hit points
  ticksPerStep: number;        // movement: lower = faster
}

export const UNITS: Record<UnitKind, UnitDef> = {
  'peasant-levy': {
    kind: 'peasant-levy', label: 'Peasant Levy',
    blurb: 'Pitchforks and panic. Cheap, fragile, available everywhere.',
    goldCost: 4, upkeepGoldPerDay: 0.1, foodPerDay: 1,
    attack: 2, defence: 2, ranged: false, hp: 12, ticksPerStep: 12,
  },
  spearman: {
    kind: 'spearman', label: 'Levy Spearman',
    blurb: 'Drilled townsmen with long spears. Solid line infantry on a budget.',
    goldCost: 10, upkeepGoldPerDay: 0.3, foodPerDay: 2,
    attack: 4, defence: 5, ranged: false, hp: 22, ticksPerStep: 10,
  },
  crossbowman: {
    kind: 'crossbowman', label: 'Crossbowman',
    blurb: 'Wall and tower defenders. Slow to load; deadly behind cover.',
    goldCost: 18, upkeepGoldPerDay: 0.5, foodPerDay: 2,
    attack: 7, defence: 3, ranged: true, hp: 18, ticksPerStep: 11,
  },
  'men-at-arms': {
    kind: 'men-at-arms', label: 'Men-at-arms',
    blurb: 'Professional soldiers in plate and chain. The backbone of any sally.',
    goldCost: 35, upkeepGoldPerDay: 1.2, foodPerDay: 2,
    attack: 9, defence: 8, ranged: false, hp: 38, ticksPerStep: 10,
  },
  knight: {
    kind: 'knight', label: 'Knight',
    blurb: 'Heavy cavalry. Few in number, devastating when committed.',
    goldCost: 80, upkeepGoldPerDay: 2.5, foodPerDay: 3,
    attack: 15, defence: 11, ranged: false, hp: 55, ticksPerStep: 7,
  },
  mercenary: {
    kind: 'mercenary', label: 'Mercenary Company',
    blurb: 'For-hire veterans. Effective and loyal — only while the gold flows.',
    goldCost: 45, upkeepGoldPerDay: 2.0, foodPerDay: 2,
    attack: 8, defence: 6, ranged: false, hp: 30, ticksPerStep: 10,
  },
};

// Units the player can buy on the setup screen (peasants/mercs come later
// through the recruitment system during the preparation phase).
export const STARTING_UNIT_KINDS: UnitKind[] = ['spearman', 'crossbowman', 'men-at-arms', 'knight'];
