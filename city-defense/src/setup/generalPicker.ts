import type { GeneralChoice, ArmyBuff } from '../world/world.ts';
import { GENERALS } from '../data/generals.ts';

export interface GeneralPicker {
  root: HTMLElement;
  selected(): GeneralChoice;
  onChange(fn: (g: GeneralChoice) => void): void;
}

export function createGeneralPicker(initialId?: string): GeneralPicker {
  const root = document.createElement('div');
  root.style.cssText = `
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.6rem;
    align-content: start;
  `;

  let selectedId = initialId ?? GENERALS[0]!.id;
  const cards = new Map<string, HTMLElement>();
  let listener: ((g: GeneralChoice) => void) | null = null;

  for (const g of GENERALS) {
    const card = document.createElement('button');
    card.type = 'button';
    card.style.cssText = `
      background: #2a1f15; color: #e6dcc8; border: 1px solid #5a4530;
      padding: 0.7rem; cursor: pointer; font-family: inherit;
      text-align: left; display: flex; flex-direction: column; gap: 0.3rem;
      transition: border-color 0.1s, background 0.1s;
    `;
    card.addEventListener('click', () => {
      selectedId = g.id;
      refresh();
      listener?.(g);
    });

    const title = document.createElement('div');
    title.style.cssText = 'color:#d4a050; font-size:0.95rem; font-weight:bold;';
    title.textContent = g.title ?? g.name;

    const name = document.createElement('div');
    name.style.cssText = 'color:#b0a080; font-size:0.78rem; font-style:italic;';
    name.textContent = g.name;

    const back = document.createElement('div');
    back.style.cssText = 'color:#9a8e74; font-size:0.78rem; line-height:1.3;';
    back.textContent = g.background ?? '';

    const effects = document.createElement('div');
    effects.style.cssText = 'font-size:0.78rem; line-height:1.4; margin-top:0.2rem;';
    effects.innerHTML =
      formatBuff(g.buff, '#90c090') +
      (g.drawback ? '<br>' + formatBuff(g.drawback, '#c08080') : '');

    card.append(title, name, back, effects);
    root.append(card);
    cards.set(g.id, card);
  }

  function refresh() {
    for (const [id, c] of cards) {
      const isSel = id === selectedId;
      c.style.borderColor = isSel ? '#d4a050' : '#5a4530';
      c.style.background = isSel ? '#3a2f25' : '#2a1f15';
    }
  }
  refresh();

  return {
    root,
    selected() {
      return GENERALS.find((g) => g.id === selectedId) ?? GENERALS[0]!;
    },
    onChange(fn) { listener = fn; },
  };
}

function formatBuff(b: ArmyBuff, color: string): string {
  const parts: string[] = [];
  const push = (s: string) => parts.push(s);
  if (b.attackPct) push(`${signed(b.attackPct)}% attack`);
  if (b.defencePct) push(`${signed(b.defencePct)}% defence`);
  if (b.movePct) push(`${signed(b.movePct)}% speed`);
  if (b.wallHpPct) push(`${signed(b.wallHpPct)}% wall HP`);
  if (b.garrisonStrengthPct) push(`${signed(b.garrisonStrengthPct)}% garrison`);
  if (b.foodConsumptionPct) push(`${signed(b.foodConsumptionPct)}% food use`);
  if (b.recruitCostPct) push(`${signed(b.recruitCostPct)}% recruit cost`);
  if (b.mercDiscountPct) push(`${b.mercDiscountPct}% off mercenaries`);
  if (b.watchEfficiencyPct) push(`${signed(b.watchEfficiencyPct)}% night watch`);
  if (b.sallySpeedPct) push(`${signed(b.sallySpeedPct)}% sally speed`);
  if (b.upkeepCostPct) push(`${signed(b.upkeepCostPct)}% upkeep`);
  if (b.startingFoodBonus) push(`+${b.startingFoodBonus} food`);
  if (b.startingGoldBonus) push(`+${b.startingGoldBonus} gold`);
  if (b.startingWoodBonus) push(`+${b.startingWoodBonus} wood`);
  if (b.startingStoneBonus) push(`+${b.startingStoneBonus} stone`);
  if (b.startingWallSegments) push(`+${b.startingWallSegments} starting walls`);
  if (b.startingNotables) push(`+${b.startingNotables} ally notable`);
  if (b.revoltThresholdDelta) push(`${signed(b.revoltThresholdDelta)} revolt floor`);
  return `<span style="color:${color}">${parts.join(' · ')}</span>`;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
