import type { World } from '../world/world.ts';
import {
  peasantConscriptCost, mercenaryHireCost, conscriptablePopulation,
  liveDailyUpkeep, mercenaryCount,
} from '../systems/recruitment.ts';
import { UNITS } from '../data/units.ts';

export interface RecruitCallbacks {
  conscript(count: number): void;
  hireMercenary(count: number): void;
}

export interface RecruitmentPanel {
  root: HTMLElement;
  update(world: World): void;
}

export function mountRecruitmentPanel(cb: RecruitCallbacks): RecruitmentPanel {
  const root = document.createElement('div');
  root.style.cssText = `
    background: rgba(0,0,0,0.75); border: 1px solid #3a2a1a;
    padding: 0.5rem; display: flex; flex-direction: column; gap: 0.35rem;
    font-size: 0.8rem;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    color: #d4a050; font-size: 0.8rem; text-transform: uppercase;
    letter-spacing: 0.05em;
  `;
  header.textContent = 'Recruit';
  root.append(header);

  // ── Peasant levy row ──
  const peasant = recruitRow('Peasant Levy', UNITS['peasant-levy'].blurb);
  peasant.plus1.addEventListener('click', () => cb.conscript(1));
  peasant.plus5.addEventListener('click', () => cb.conscript(5));
  root.append(peasant.root);

  // ── Mercenary row ──
  const merc = recruitRow('Mercenary', UNITS.mercenary.blurb);
  merc.plus1.addEventListener('click', () => cb.hireMercenary(1));
  merc.plus5.addEventListener('click', () => cb.hireMercenary(5));
  root.append(merc.root);

  // ── Roster summary ──
  const summary = document.createElement('div');
  summary.style.cssText = `
    margin-top: 0.2rem; padding-top: 0.3rem;
    border-top: 1px dashed #5a4530;
    font-size: 0.72rem; color: #9a8e74; line-height: 1.4;
  `;
  root.append(summary);

  return {
    root,
    update(world) {
      const peasantCost = peasantConscriptCost(world);
      const mercCost = mercenaryHireCost(world);
      const avail = conscriptablePopulation(world);

      peasant.cost.textContent = `${peasantCost}g · ${avail} available`;
      peasant.cost.style.color = avail === 0 ? '#9a8e74' : '#c0b090';
      const cantConscript = avail === 0 || world.resources.gold < peasantCost;
      peasant.plus1.disabled = cantConscript;
      peasant.plus5.disabled = avail < 5 || world.resources.gold < peasantCost * 5;

      merc.cost.textContent = `${mercCost}g + ${UNITS.mercenary.upkeepGoldPerDay}g/day`;
      merc.cost.style.color = '#c0b090';
      merc.plus1.disabled = world.resources.gold < mercCost;
      merc.plus5.disabled = world.resources.gold < mercCost * 5;

      const upkeep = liveDailyUpkeep(world);
      const mercs = mercenaryCount(world);
      const desertWarn = mercs > 0 && world.resources.gold < 50;
      summary.innerHTML = [
        `Total soldiers: ${world.components.soldier.map.size}`,
        `Mercenaries: ${mercs}` + (desertWarn ? ' <span style="color:#e06060">⚠ desertion risk</span>' : ''),
        `Daily upkeep: ${upkeep.toFixed(1)}g`,
      ].join('<br>');
    },
  };
}

function recruitRow(label: string, blurb: string): {
  root: HTMLElement;
  cost: HTMLElement;
  plus1: HTMLButtonElement;
  plus5: HTMLButtonElement;
} {
  const root = document.createElement('div');
  root.style.cssText = `
    display: grid; grid-template-columns: 1fr 5rem; gap: 0.3rem;
    align-items: center; padding: 0.2rem 0;
  `;
  const left = document.createElement('div');
  left.style.cssText = 'display: flex; flex-direction: column; gap: 0.05rem;';
  const name = document.createElement('div');
  name.style.cssText = 'font-weight: bold; color: #e6dcc8;';
  name.textContent = label;
  const blurbEl = document.createElement('div');
  blurbEl.style.cssText = 'font-size: 0.7rem; color: #9a8e74; line-height: 1.3;';
  blurbEl.textContent = blurb;
  const cost = document.createElement('div');
  cost.style.cssText = 'font-size: 0.7rem; color: #c0b090; margin-top: 0.1rem;';
  left.append(name, blurbEl, cost);

  const buttons = document.createElement('div');
  buttons.style.cssText = 'display: flex; gap: 0.2rem;';
  const plus1 = stepBtn('+1');
  const plus5 = stepBtn('+5');
  buttons.append(plus1, plus5);

  root.append(left, buttons);
  return { root, cost, plus1, plus5 };
}

function stepBtn(label: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.style.cssText = `
    min-width: 2rem; height: 1.5rem;
    background: #5a4530; color: #f0e4c8; border: 1px solid #8a6a45;
    cursor: pointer; font-family: inherit; font-size: 0.75rem;
    padding: 0 0.3rem; line-height: 1;
  `;
  return b;
}
