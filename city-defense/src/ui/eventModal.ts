import type { World } from '../world/world.ts';
import { pendingEvent, pendingChoiceAffordable } from '../systems/events.ts';
import type { EventChoice, ChoiceCost, EventEffect, EventCategory } from '../data/events.ts';

export interface EventModalCallbacks {
  onChoose(choiceIndex: number): void;
}

export interface EventModal {
  root: HTMLElement;
  update(world: World): void;
}

const CATEGORY_COLOR: Record<EventCategory, string> = {
  economic:  '#c0a050',
  military:  '#c06060',
  political: '#a070c0',
  weather:   '#70a0c0',
  chained:   '#d4a050',
};

const CATEGORY_LABEL: Record<EventCategory, string> = {
  economic:  'Economic',
  military:  'Military',
  political: 'Political',
  weather:   'Weather',
  chained:   'Story',
};

export function mountEventModal(cb: EventModalCallbacks): EventModal {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: absolute; inset: 0;
    background: rgba(0, 0, 0, 0.65);
    display: none; align-items: center; justify-content: center;
    z-index: 13;
  `;

  const panel = document.createElement('div');
  panel.style.cssText = `
    max-width: 32rem; width: 92%;
    background: #2a1f15; border: 1px solid #8a6a45; border-top: 4px solid #d4a050;
    padding: 1.5rem 1.8rem 1.2rem;
    color: #f0e4c8; font-family: inherit;
    box-shadow: 0 12px 40px rgba(0,0,0,0.6);
    max-height: 90vh; overflow-y: auto;
  `;

  const tag = document.createElement('div');
  tag.style.cssText = `
    display: inline-block; font-size: 0.7rem; text-transform: uppercase;
    letter-spacing: 0.12em; padding: 0.15rem 0.5rem;
    border: 1px solid currentColor;
    margin-bottom: 0.5rem;
  `;

  const title = document.createElement('h2');
  title.style.cssText = 'margin: 0 0 0.7rem; color: #d4a050; font-size: 1.3rem; line-height: 1.2;';

  const body = document.createElement('p');
  body.style.cssText = 'margin: 0 0 1.2rem; color: #d8cca8; font-style: italic; line-height: 1.5;';

  const choicesEl = document.createElement('div');
  choicesEl.style.cssText = 'display: flex; flex-direction: column; gap: 0.4rem;';

  panel.append(tag, title, body, choicesEl);
  overlay.append(panel);

  return {
    root: overlay,
    update(world) {
      const def = pendingEvent(world);
      if (!def) {
        overlay.style.display = 'none';
        return;
      }
      tag.textContent = `${CATEGORY_LABEL[def.category]} · Day ${world.day}`;
      tag.style.color = CATEGORY_COLOR[def.category];
      title.textContent = def.title;
      body.textContent = def.body;

      choicesEl.innerHTML = '';
      def.choices.forEach((c, idx) => {
        choicesEl.append(renderChoice(world, c, idx, cb));
      });
      overlay.style.display = 'flex';
    },
  };
}

function renderChoice(world: World, c: EventChoice, idx: number, cb: EventModalCallbacks): HTMLElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  const affordable = pendingChoiceAffordable(world, c);
  btn.disabled = !affordable;
  btn.style.cssText = `
    background: ${affordable ? '#3a2f25' : '#1f1810'};
    color: ${affordable ? '#f0e4c8' : '#7a6e5a'};
    border: 1px solid ${affordable ? '#8a6a45' : '#3a2a1a'};
    padding: 0.6rem 0.8rem;
    cursor: ${affordable ? 'pointer' : 'not-allowed'};
    font-family: inherit; font-size: 0.9rem;
    text-align: left; line-height: 1.35;
    display: flex; flex-direction: column; gap: 0.15rem;
  `;
  if (affordable) {
    btn.addEventListener('mouseenter', () => { btn.style.background = '#4a3f35'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#3a2f25'; });
  }
  btn.addEventListener('click', () => cb.onChoose(idx));

  const label = document.createElement('span');
  label.textContent = c.label;
  label.style.cssText = 'font-weight: bold;';
  btn.append(label);

  if (c.cost) {
    const costLine = document.createElement('span');
    costLine.style.cssText = `font-size: 0.75rem; color: ${affordable ? '#b09060' : '#a04040'};`;
    costLine.textContent = `Requires: ${formatCost(c.cost)}`;
    btn.append(costLine);
  }
  const effectsLine = formatEffects(c.effects);
  if (effectsLine) {
    const fx = document.createElement('span');
    fx.style.cssText = 'font-size: 0.75rem; color: #90c090;';
    fx.textContent = effectsLine;
    btn.append(fx);
  }
  return btn;
}

function formatCost(c: ChoiceCost): string {
  const parts: string[] = [];
  if (c.gold) parts.push(`${c.gold} gold`);
  if (c.food) parts.push(`${c.food} food`);
  if (c.wood) parts.push(`${c.wood} wood`);
  if (c.stone) parts.push(`${c.stone} stone`);
  return parts.join(', ');
}

function formatEffects(effects: EventEffect[]): string {
  const parts: string[] = [];
  for (const e of effects) {
    switch (e.kind) {
      case 'food': parts.push(`${signed(e.delta)} food`); break;
      case 'gold': parts.push(`${signed(e.delta)} gold`); break;
      case 'wood': parts.push(`${signed(e.delta)} wood`); break;
      case 'stone': parts.push(`${signed(e.delta)} stone`); break;
      case 'morale': parts.push(`${signed(e.delta)} morale`); break;
      case 'population': parts.push(`${signed(e.delta)} citizens`); break;
      case 'loyalty-role': parts.push(`${signed(e.delta)} loyalty (${e.role})`); break;
      case 'loyalty-trait': parts.push(`${signed(e.delta)} loyalty (${e.trait})`); break;
      case 'loyalty-all': parts.push(`${signed(e.delta)} loyalty (all)`); break;
      case 'spawn-enemies': parts.push(`+${e.count} ${e.enemy}${e.count === 1 ? '' : 's'}`); break;
      case 'damage-random-wall': parts.push(`wall damage ${e.amount}`); break;
      case 'damage-keep': parts.push(`keep damage ${e.amount}`); break;
      case 'spawn-soldiers': parts.push(`+${e.count} ${e.unit}`); break;
      case 'queue-followup': parts.push(`later: ${e.defId}`); break;
    }
  }
  return parts.join(' · ');
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
