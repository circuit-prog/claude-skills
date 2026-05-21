import type { World } from '../world/world.ts';
import type { DutyKind } from '../ecs/components.ts';
import { countByDuty } from '../systems/duties.ts';

export interface DutyCallbacks {
  reassign(from: DutyKind, to: DutyKind, count: number): void;
  startSiege(): void;
}

export interface DutiesPanel {
  root: HTMLElement;
  update(world: World): void;
}

const ASSIGNABLE: ReadonlyArray<{ kind: DutyKind; label: string; hint: string }> = [
  { kind: 'reserve', label: 'Reserve', hint: 'Hold near the keep' },
  { kind: 'wall',    label: 'Walls',   hint: 'Garrison the nearest wall' },
  { kind: 'sally',   label: 'Sally',   hint: 'Hunt enemies in the open' },
  { kind: 'watch',   label: 'Watch',   hint: 'Patrol the city — raises morale' },
];

export function mountDutiesPanel(cb: DutyCallbacks): DutiesPanel {
  const root = document.createElement('div');
  root.style.cssText = `
    background: rgba(0,0,0,0.75); border: 1px solid #3a2a1a;
    padding: 0.5rem; display: flex; flex-direction: column; gap: 0.3rem;
    font-size: 0.8rem;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    color: #d4a050; font-size: 0.8rem; text-transform: uppercase;
    letter-spacing: 0.05em;
  `;
  header.textContent = 'Duties';
  root.append(header);

  const total = document.createElement('div');
  total.style.cssText = 'color:#c0b090; font-size: 0.75rem;';
  root.append(total);

  const rows = new Map<DutyKind, {
    row: HTMLElement;
    countLabel: HTMLElement;
    plus1: HTMLButtonElement; plus5: HTMLButtonElement;
    minus1: HTMLButtonElement; minus5: HTMLButtonElement;
  }>();

  for (const d of ASSIGNABLE) {
    const row = document.createElement('div');
    row.style.cssText = `
      display: grid; grid-template-columns: 1fr 6.5rem; gap: 0.3rem;
      align-items: center; padding: 0.2rem 0;
    `;
    const left = document.createElement('div');
    left.style.cssText = 'display:flex; flex-direction:column;';
    const name = document.createElement('div');
    name.style.cssText = 'font-weight: bold; color: #e6dcc8;';
    name.textContent = d.label;
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size: 0.7rem; color: #9a8e74;';
    hint.textContent = d.hint;
    const countLabel = document.createElement('div');
    countLabel.style.cssText = 'font-size: 0.7rem; color: #d4a050; margin-top: 0.1rem;';
    left.append(name, hint, countLabel);

    const stepper = document.createElement('div');
    stepper.style.cssText = 'display: flex; gap: 0.15rem;';
    const minus5 = stepBtn('−5');
    const minus1 = stepBtn('−');
    const plus1 = stepBtn('+');
    const plus5 = stepBtn('+5');
    minus5.addEventListener('click', () => cb.reassign(d.kind, 'reserve', 5));
    minus1.addEventListener('click', () => cb.reassign(d.kind, 'reserve', 1));
    plus1.addEventListener('click',  () => cb.reassign('reserve', d.kind, 1));
    plus5.addEventListener('click',  () => cb.reassign('reserve', d.kind, 5));
    // For Reserve row, swap the meaning: + pulls back from sally (closest
    // analog) and − sends to wall as a fast bulk action.
    if (d.kind === 'reserve') {
      minus5.style.visibility = 'hidden';
      minus1.style.visibility = 'hidden';
      plus5.style.visibility = 'hidden';
      plus1.style.visibility = 'hidden';
    }
    stepper.append(minus5, minus1, plus1, plus5);

    row.append(left, stepper);
    root.append(row);
    rows.set(d.kind, { row, countLabel, plus1, plus5, minus1, minus5 });
  }

  const siegeBtn = document.createElement('button');
  siegeBtn.textContent = 'I am ready — begin the siege';
  siegeBtn.style.cssText = `
    background: #5a3030; color: #f0e4c8; border: 1px solid #8a4545;
    padding: 0.35rem 0.5rem; cursor: pointer; font-family: inherit;
    font-size: 0.8rem; margin-top: 0.4rem; display: none;
  `;
  siegeBtn.addEventListener('click', cb.startSiege);
  root.append(siegeBtn);

  return {
    root,
    update(world) {
      const c = countByDuty(world);
      total.textContent = `${c.total} soldier${c.total === 1 ? '' : 's'} total`;
      for (const d of ASSIGNABLE) {
        const r = rows.get(d.kind);
        if (!r) continue;
        const n = c[d.kind];
        r.countLabel.textContent = `Currently: ${n}`;
      }
      siegeBtn.style.display = world.phase === 'preparation' ? 'block' : 'none';
    },
  };
}

function stepBtn(label: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.style.cssText = `
    min-width: 1.4rem; height: 1.4rem;
    background: #5a4530; color: #f0e4c8; border: 1px solid #8a6a45;
    cursor: pointer; font-family: inherit; font-size: 0.75rem;
    padding: 0 0.2rem; line-height: 1;
  `;
  return b;
}
