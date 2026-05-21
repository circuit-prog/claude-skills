import type { SetupChoices } from '../world/world.ts';
import { createGeneralPicker } from './generalPicker.ts';
import { createArmyComposer } from './armyComposer.ts';

export interface SetupScreen {
  show(initial?: Partial<SetupChoices>): Promise<SetupChoices>;
}

export function mountSetupScreen(root: HTMLElement): SetupScreen {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: absolute; inset: 0;
    background: linear-gradient(180deg, #1a1410 0%, #2a1f15 100%);
    display: none; flex-direction: column; align-items: center;
    overflow-y: auto; z-index: 20;
    padding: 1.5rem 2rem 2rem; box-sizing: border-box;
  `;

  const heading = document.createElement('div');
  heading.style.cssText = `
    width: 100%; max-width: 64rem; margin-bottom: 1rem;
    color: #d4a050; text-align: center;
  `;
  heading.innerHTML = `
    <h1 style="margin:0 0 0.3rem; font-size:1.8rem;">City Defense</h1>
    <div style="color:#b0a080; font-style:italic; font-size:0.9rem;">
      Choose your general and prepare your garrison before the siege begins.
    </div>
  `;

  const grid = document.createElement('div');
  grid.style.cssText = `
    width: 100%; max-width: 64rem;
    display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem;
    align-items: start;
  `;

  const generalCol = column('General — pick one');
  const picker = createGeneralPicker();
  generalCol.body.append(picker.root);

  const armyCol = column('Army — buy your troops');
  const composer = createArmyComposer();
  armyCol.body.append(composer.root);
  composer.setGeneral(picker.selected());
  picker.onChange((g) => { composer.setGeneral(g); });

  grid.append(generalCol.root, armyCol.root);

  const footer = document.createElement('div');
  footer.style.cssText = `
    width: 100%; max-width: 64rem; margin-top: 1.2rem;
    display: flex; justify-content: flex-end; gap: 0.8rem; align-items: center;
  `;

  const seedLabel = document.createElement('label');
  seedLabel.style.cssText = 'color:#b0a080; font-size:0.85rem;';
  seedLabel.textContent = 'Seed:';
  const seedInput = document.createElement('input');
  seedInput.type = 'number';
  seedInput.style.cssText = `
    background: #1f1810; color: #f0e4c8; border: 1px solid #5a4530;
    padding: 0.3rem 0.5rem; font-family: inherit; font-size: 0.85rem;
    width: 8rem;
  `;
  seedInput.value = String(Math.floor(Math.random() * 0xffffffff));

  const beginBtn = document.createElement('button');
  beginBtn.textContent = 'Begin Preparation';
  beginBtn.style.cssText = `
    background: #5a4530; color: #f0e4c8; border: 1px solid #8a6a45;
    padding: 0.6rem 1.4rem; font-family: inherit; font-size: 1rem;
    cursor: pointer;
  `;

  footer.append(seedLabel, seedInput, beginBtn);

  overlay.append(heading, grid, footer);
  root.append(overlay);

  let resolver: ((choice: SetupChoices) => void) | null = null;

  beginBtn.addEventListener('click', () => {
    const choice: SetupChoices = {
      seed: Number(seedInput.value) || Math.floor(Math.random() * 0xffffffff),
      general: picker.selected(),
      army: composer.composition(),
    };
    overlay.style.display = 'none';
    resolver?.(choice);
    resolver = null;
  });

  return {
    show(initial) {
      if (initial?.seed !== undefined) seedInput.value = String(initial.seed);
      overlay.style.display = 'flex';
      return new Promise<SetupChoices>((resolve) => { resolver = resolve; });
    },
  };
}

function column(title: string): { root: HTMLElement; body: HTMLElement } {
  const root = document.createElement('div');
  root.style.cssText = 'display: flex; flex-direction: column; gap: 0.6rem;';
  const header = document.createElement('div');
  header.style.cssText = `
    color: #d4a050; font-size: 0.85rem; text-transform: uppercase;
    letter-spacing: 0.05em; border-bottom: 1px solid #3a2a1a;
    padding-bottom: 0.3rem;
  `;
  header.textContent = title;
  const body = document.createElement('div');
  body.style.cssText = 'display: flex; flex-direction: column; gap: 0.6rem;';
  root.append(header, body);
  return { root, body };
}
