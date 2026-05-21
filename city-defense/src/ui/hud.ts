import type { World, SpeedSetting } from '../world/world.ts';
import type { BuildingKind } from '../ecs/components.ts';
import { BUILDABLE_KINDS, buildingDef } from '../data/buildings.ts';

export interface HudCallbacks {
  setSpeed(speed: SpeedSetting): void;
  selectBuilding(kind: BuildingKind | null): void;
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
  const gold = resource('Gold');
  const wood = resource('Wood');
  const stone = resource('Stone');
  const pop = resource('Pop');
  const morale = resource('Morale');
  const phase = el('div', 'phase');
  bar.append(food.root, gold.root, wood.root, stone.root, pop.root, morale.root, phase);

  const buildMenu = el('div', 'hud-build');
  buildMenu.style.cssText = `
    position: absolute; left: 1rem; top: 4rem;
    background: rgba(0,0,0,0.75); border: 1px solid #3a2a1a;
    padding: 0.5rem; max-width: 13rem;
    display: flex; flex-direction: column; gap: 0.3rem;
    font-size: 0.85rem;
  `;
  const buildTitle = el('div');
  buildTitle.style.cssText = 'color:#d4a050; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.2rem;';
  buildTitle.textContent = 'Build';
  buildMenu.append(buildTitle);

  const buildButtons = new Map<BuildingKind | null, HTMLButtonElement>();
  const cancelBtn = makeBuildButton('Cancel (Esc)', null, cb);
  buildButtons.set(null, cancelBtn);
  buildMenu.append(cancelBtn);
  for (const k of BUILDABLE_KINDS) {
    const btn = makeBuildButton(`${buildingDef(k).label}`, k, cb);
    buildButtons.set(k, btn);
    buildMenu.append(btn);
  }

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

  root.append(bar, buildMenu, controls);

  return {
    update(world, selected) {
      food.value.textContent = String(Math.floor(world.resources.food));
      gold.value.textContent = String(Math.floor(world.resources.gold));
      wood.value.textContent = String(Math.floor(world.resources.wood));
      stone.value.textContent = String(Math.floor(world.resources.stone));
      pop.value.textContent = String(world.population.total);
      morale.value.textContent = `${Math.round(world.population.morale)}`;

      const dayTxt = `Day ${world.day} / ${world.daysToSurvive}`;
      if (world.phase === 'preparation') {
        phase.textContent = `${dayTxt} — Preparation (siege in ${world.daysUntilSiege}d)`;
      } else {
        phase.textContent = `${dayTxt} — Under Siege`;
      }

      for (const [k, btn] of buildButtons) btn.classList.toggle('active', selected === k);
      for (const k of [0, 1, 2, 4] as SpeedSetting[]) speedButtons[k].classList.toggle('active', world.speed === k);
    },
  };
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
    font-size: 0.85rem; text-align: left;
  `;
  b.addEventListener('click', () => cb.selectBuilding(kind));
  return b;
}
