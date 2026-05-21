import type { GeneralChoice } from '../world/world.ts';

// Starting general roster. Each buff applies multiplicatively where the
// system that owns it reads world.general.buff — never special-cased.
export const GENERALS: GeneralChoice[] = [
  {
    id: 'veteran-knight',
    name: 'Ser Halric the Veteran',
    title: 'The Veteran Knight',
    background: 'Old, scarred, has seen three sieges. The garrison would die for him.',
    buff: { attackPct: 15, defencePct: 5 },
    drawback: { recruitCostPct: 5 },
  },
  {
    id: 'wall-engineer',
    name: 'Master Olwen of Greystone',
    title: 'The Wall Engineer',
    background: 'Built the new bastion at Greystone. The stone speaks to him.',
    buff: { wallHpPct: 20, startingStoneBonus: 100, startingWallSegments: 6 },
    drawback: { attackPct: -5 },
  },
  {
    id: 'quartermaster',
    name: 'Lady Brenna Tallow',
    title: 'The Quartermaster',
    background: 'Cousin to the grain merchants. Knows the price of every loaf.',
    buff: { startingFoodBonus: 250, foodConsumptionPct: -15, startingGoldBonus: 50 },
    drawback: { attackPct: -10 },
  },
  {
    id: 'diplomat',
    name: 'Lord Verren of Ashvale',
    title: 'The Diplomat',
    background: 'Speaks four tongues. Owed favours by every minor house.',
    buff: { mercDiscountPct: 25, startingGoldBonus: 120, startingNotables: 1 },
    drawback: { defencePct: -10 },
  },
  {
    id: 'iron-hand',
    name: 'Captain Maesa the Iron',
    title: 'The Iron Hand',
    background: 'Hangs deserters at dawn. The watchmen do not sleep on her shift.',
    buff: { watchEfficiencyPct: 25, garrisonStrengthPct: 10 },
    drawback: { revoltThresholdDelta: 5 },
  },
  {
    id: 'cavalry-commander',
    name: 'Ser Tomas Ravenhill',
    title: 'The Cavalry Commander',
    background: 'Won three sallies at Blackford. Fastest mailed lance in the realm.',
    buff: { sallySpeedPct: 30, attackPct: 10, movePct: 15 },
    drawback: { upkeepCostPct: 15 },
  },
];

export function getGeneral(id: string): GeneralChoice {
  const g = GENERALS.find((x) => x.id === id);
  if (!g) throw new Error(`unknown general: ${id}`);
  return g;
}
