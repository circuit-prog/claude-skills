import type { World, SpeedSetting } from '../world/world.ts';
import type { BuildingKind } from '../ecs/components.ts';
import { BUILDABLE_KINDS, buildingDef } from '../data/buildings.ts';
import { daysOfFoodRemaining } from '../systems/food.ts';
import { housingCapacity } from '../systems/population.ts';
import { mountNotablesPanel } from './notablesPanel.ts';
import type { NotablesPanel } from './notablesPanel.ts';
import { mountRequestInbox } from './requestInbox.ts';
import type { RequestInbox } from './requestInbox.ts';

export interface HudCallbacks {
  setSpeed(speed: SpeedSetting): void;
  selectBuilding(kind: BuildingKind | null): void;
  setTaxRate(rate: number): void;
  setRationing(r: World['policy']['rationing']): void;
  acceptRequest(id: string): void;
  declineRequest(id: string): void;
  saveGame(): void;
  loadGame(): boolean;
}

export interface Hud {
  update(world: World, selected: BuildingKind | null): void;
}

export function mountHud(root: HTMLElement, cb: HudCallbacks): Hud {
  root.innerHTML = '';

  const bar = el('div', 'hud-bar');
  const food = resource('Food');
  const foodHint = el('span');
  foodHint.style.cssText = 'font-size: 0.75rem; color: #b09060; margin-left: 0.3rem;';
  food.root.append(foodHint);
  const gold = resource('Gold');
  const wood = resource('Wood');
  const stone = resource('Stone');
  const pop = resource('Pop');
  const morale = resource('Morale');
  const phase = el('div', 'phase');
  bar.append(food.root, gold.root, wood.root, stone.root, pop.root, morale.root, phase);

  // Left-side panel: build menu + policy controls
  const left = el('div');
  left.style.cssText = `
    position: absolute; left: 1rem; top: 4rem; bottom: 5rem;
    width: 13rem; display: flex; flex-direction: column; gap: 0.7rem;
    overflow-y: auto;
  `;

  const buildMenu = panelSection('Build');
  const buildButtons = new Map<BuildingKind | null, HTMLButtonElement>();
  const cancelBtn = makeBuildButton('Cancel (Esc)', null, cb);
  buildButtons.set(null, cancelBtn);
  buildMenu.body.append(cancelBtn);
  for (const k of BUILDABLE_KINDS) {
    const def = buildingDef(k);
    const cost = `${def.cost.wood}w ${def.cost.stone}s ${def.cost.gold}g`;
    const btn = makeBuildButton(`${def.label} — ${cost}`, k, cb);
    buildButtons.set(k, btn);
    buildMenu.body.append(btn);
  }

  const policy = panelSection('Policy');
  const taxLabel = el('div');
  taxLabel.style.cssText = 'font-size: 0.8rem; color: #c0b090;';
  const taxSlider = document.createElement('input');
  taxSlider.type = 'range';
  taxSlider.min = '0';
  taxSlider.max = '30';
  taxSlider.step = '1';
  taxSlider.style.cssText = 'width: 100%;';
  taxSlider.addEventListener('input', () => {
    cb.setTaxRate(Number(taxSlider.value));
  });

  const rationLabel = el('div');
  rationLabel.style.cssText = 'font-size: 0.8rem; color: #c0b090; margin-top: 0.5rem;';
  rationLabel.textContent = 'Rations';
  const rationRow = el('div');
  rationRow.style.cssText = 'display: flex; gap: 0.3rem;';
  const rationButtons: Record<World['policy']['rationing'], HTMLButtonElement> = {
    'normal': rationButton('Normal', 'normal', cb),
    'half': rationButton('Half', 'half', cb),
    'starve-soldiers': rationButton('Civ first', 'starve-soldiers', cb),
  };
  rationRow.append(rationButtons.normal, rationButtons.half, rationButtons['starve-soldiers']);

  policy.body.append(taxLabel, taxSlider, rationLabel, rationRow);

  const status = panelSection('Status');
  const statusLines = el('div');
  statusLines.style.cssText = 'font-size: 0.8rem; line-height: 1.35; color: #c0b090;';
  status.body.append(statusLines);

  const notablesPanel: NotablesPanel = mountNotablesPanel();

  left.append(buildMenu.root, policy.root, status.root, notablesPanel.root);

  const requestInbox: RequestInbox = mountRequestInbox({
    onAccept: (id) => cb.acceptRequest(id),
    onDecline: (id) => cb.declineRequest(id),
  });

  const controls = el('div', 'hud-controls');
  const speedButtons: Record<SpeedSetting, HTMLButtonElement> = {
    0: speedButton('||', 0, cb),
    1: speedButton('1x', 1, cb),
    2: speedButton('2x', 2, cb),
    4: speedButton('4x', 4, cb),
  };
  const saveBtn = el('button') as HTMLButtonElement;
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', cb.saveGame);
  const loadBtn = el('button') as HTMLButtonElement;
  loadBtn.textContent = 'Load';
  loadBtn.addEventListener('click', () => { cb.loadGame(); });
  controls.append(
    speedButtons[0], speedButtons[1], speedButtons[2], speedButtons[4],
    spacer(), saveBtn, loadBtn,
  );

  root.append(bar, left, requestInbox.root, controls);

  return {
    update(world, selected) {
      food.value.textContent = String(Math.floor(world.resources.food));
      const dof = daysOfFoodRemaining(world);
      foodHint.textContent = dof === Infinity ? '' : `(${dof}d)`;
      foodHint.style.color = dof <= 3 ? '#e08060' : dof <= 7 ? '#d4a050' : '#b09060';
      gold.value.textContent = String(Math.floor(world.resources.gold));
      wood.value.textContent = String(Math.floor(world.resources.wood));
      stone.value.textContent = String(Math.floor(world.resources.stone));
      pop.value.textContent = `${world.population.total}/${housingCapacity(world)}`;
      morale.value.textContent = `${Math.round(world.population.morale)}`;
      morale.value.style.color = moraleColor(world.population.morale);

      const dayTxt = `Day ${world.day} / ${world.daysToSurvive}`;
      if (world.phase === 'preparation') {
        phase.textContent = `${dayTxt} · Preparation · Siege in ${world.daysUntilSiege}d`;
      } else {
        phase.textContent = `${dayTxt} · Under Siege`;
      }

      taxSlider.value = String(world.policy.taxRate);
      taxLabel.textContent = `Tax rate: ${world.policy.taxRate}% (baseline 10%)`;
      for (const k of ['normal', 'half', 'starve-soldiers'] as const) {
        rationButtons[k].classList.toggle('active', world.policy.rationing === k);
      }

      const statusBits: string[] = [];
      if (world.population.homeless > 0) statusBits.push(`Homeless: ${world.population.homeless}`);
      if (world.population.rioting) statusBits.push(`<span style="color:#e06060">RIOT IN PROGRESS</span>`);
      else if (world.population.daysInUnrest > 0) statusBits.push(`Unrest day ${world.population.daysInUnrest}`);
      if (world.population.daysWithoutFood > 0) statusBits.push(`<span style="color:#e08060">Hungry for ${world.population.daysWithoutFood}d</span>`);
      if (world.population.starvationDeaths > 0) statusBits.push(`Dead from starvation: ${world.population.starvationDeaths}`);
      statusBits.push(`Season: ${world.season}`);
      statusLines.innerHTML = statusBits.join('<br>');

      for (const [k, btn] of buildButtons) btn.classList.toggle('active', selected === k);
      for (const k of [0, 1, 2, 4] as SpeedSetting[]) speedButtons[k].classList.toggle('active', world.speed === k);

      notablesPanel.update(world);
      requestInbox.update(world);
    },
  };
}

function moraleColor(v: number): string {
  if (v < 20) return '#e06060';
  if (v < 40) return '#e0a060';
  if (v < 60) return '#e0d060';
  return '#90e090';
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function spacer(): HTMLElement {
  const s = document.createElement('span');
  s.style.cssText = 'width: 0.5rem;';
  return s;
}

function resource(label: string): { root: HTMLElement; value: HTMLElement } {
  const root = el('div', 'resource');
  const lab = el('span', 'label');
  lab.textContent = label;
  const value = el('span', 'value');
  value.textContent = '0';
  root.append(lab, value);
  return { root, value };
}

function panelSection(title: string): { root: HTMLElement; body: HTMLElement } {
  const root = document.createElement('div');
  root.style.cssText = `
    background: rgba(0,0,0,0.75); border: 1px solid #3a2a1a;
    padding: 0.5rem; display: flex; flex-direction: column; gap: 0.3rem;
  `;
  const header = document.createElement('div');
  header.textContent = title;
  header.style.cssText = 'color:#d4a050; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em;';
  const body = document.createElement('div');
  body.style.cssText = 'display:flex; flex-direction:column; gap:0.3rem;';
  root.append(header, body);
  return { root, body };
}

function speedButton(label: string, speed: SpeedSetting, cb: HudCallbacks): HTMLButtonElement {
  const b = el('button');
  b.textContent = label;
  b.addEventListener('click', () => cb.setSpeed(speed));
  return b;
}

function makeBuildButton(label: string, kind: BuildingKind | null, cb: HudCallbacks): HTMLButtonElement {
  const b = el('button');
  b.textContent = label;
  b.style.cssText = `
    background: #2a1f15; color: #e6dcc8; border: 1px solid #5a4530;
    padding: 0.25rem 0.5rem; cursor: pointer; font-family: inherit;
    font-size: 0.8rem; text-align: left;
  `;
  b.addEventListener('click', () => cb.selectBuilding(kind));
  return b;
}

function rationButton(label: string, r: World['policy']['rationing'], cb: HudCallbacks): HTMLButtonElement {
  const b = el('button');
  b.textContent = label;
  b.style.cssText = `
    flex: 1; background: #2a1f15; color: #e6dcc8; border: 1px solid #5a4530;
    padding: 0.2rem 0.3rem; cursor: pointer; font-family: inherit;
    font-size: 0.75rem;
  `;
  b.addEventListener('click', () => cb.setRationing(r));
  return b;
}
