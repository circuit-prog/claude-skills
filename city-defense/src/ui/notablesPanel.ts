import type { World } from '../world/world.ts';
import type { NotableRole } from '../ecs/components.ts';
import { DISLOYAL_THRESHOLD } from '../systems/notables.ts';

export interface NotablesPanel {
  root: HTMLElement;
  update(world: World): void;
}

const ROLE_LABEL: Record<NotableRole, string> = {
  captain: 'Capt.', sergeant: 'Sgt.', noble: 'Noble',
  merchant: 'Merchant', craftsman: 'Master', advisor: 'Counsellor',
};

const ROLE_ORDER: NotableRole[] = ['captain', 'sergeant', 'noble', 'merchant', 'craftsman', 'advisor'];

export function mountNotablesPanel(): NotablesPanel {
  const root = document.createElement('div');
  root.style.cssText = `
    background: rgba(0,0,0,0.75); border: 1px solid #3a2a1a;
    padding: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem;
    font-size: 0.78rem;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    color: #d4a050; font-size: 0.8rem; text-transform: uppercase;
    letter-spacing: 0.05em; margin-bottom: 0.1rem;
  `;
  header.textContent = 'Notables';
  root.append(header);

  const list = document.createElement('div');
  list.style.cssText = 'display: flex; flex-direction: column; gap: 0.15rem; max-height: 16rem; overflow-y: auto;';
  root.append(list);

  return {
    root,
    update(world) {
      // Sort by loyalty ascending — surfaces the people about to defect at the top.
      const all = [...world.components.notable.map.values()];
      all.sort((a, b) => {
        if (a.personalLoyalty !== b.personalLoyalty) return a.personalLoyalty - b.personalLoyalty;
        return ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
      });

      list.innerHTML = '';
      if (all.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'color:#9a8e74; font-style: italic; padding: 0.3rem;';
        empty.textContent = 'No notables yet.';
        list.append(empty);
        return;
      }

      for (const n of all) {
        const row = document.createElement('div');
        row.style.cssText = 'display: grid; grid-template-columns: 1fr 2.2rem; gap: 0.3rem; align-items: center; padding: 0.15rem 0;';
        const isDisloyal = n.personalLoyalty < DISLOYAL_THRESHOLD;

        const left = document.createElement('div');
        left.style.cssText = 'display:flex; flex-direction:column; gap:0.05rem; min-width:0;';
        const name = document.createElement('div');
        name.style.cssText = `color: ${isDisloyal ? '#e08060' : '#e6dcc8'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;
        name.textContent = n.name;
        name.title = `${ROLE_LABEL[n.role]} · ${n.traits.join(', ')}`;
        const meta = document.createElement('div');
        meta.style.cssText = 'color:#9a8e74; font-size: 0.7rem;';
        meta.textContent = `${ROLE_LABEL[n.role]} · ${n.traits.join(', ')}`;
        left.append(name, meta);

        const right = document.createElement('div');
        right.style.cssText = `
          color: ${loyaltyColor(n.personalLoyalty)};
          font-variant-numeric: tabular-nums; text-align: right;
          font-weight: bold;
        `;
        right.textContent = String(Math.round(n.personalLoyalty));

        row.append(left, right);
        list.append(row);
      }
    },
  };
}

function loyaltyColor(v: number): string {
  if (v < DISLOYAL_THRESHOLD) return '#e06060';
  if (v < 50) return '#e0a060';
  if (v < 75) return '#e0d060';
  return '#90c090';
}
