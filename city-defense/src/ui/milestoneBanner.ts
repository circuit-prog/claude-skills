import type { World } from '../world/world.ts';
import { pendingMilestone, dismissPendingMilestone } from '../systems/milestones.ts';
import { ACT_LABEL } from '../data/milestones.ts';

export interface MilestoneBanner {
  root: HTMLElement;
  update(world: World): void;
}

export interface MilestoneCallbacks {
  /** Called when the player dismisses the banner. */
  onDismiss(world: World): void;
}

export function mountMilestoneBanner(cb: MilestoneCallbacks, getWorld: () => World): MilestoneBanner {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: absolute; inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: none; align-items: center; justify-content: center;
    z-index: 12;
  `;

  const panel = document.createElement('div');
  panel.style.cssText = `
    max-width: 28rem; background: #2a1f15;
    border: 1px solid #8a6a45; border-top: 4px solid #d4a050;
    padding: 1.5rem 1.8rem 1.2rem;
    color: #f0e4c8; font-family: inherit;
    box-shadow: 0 12px 40px rgba(0,0,0,0.6);
  `;

  const act = document.createElement('div');
  act.style.cssText = `
    color: #b09060; font-size: 0.75rem; text-transform: uppercase;
    letter-spacing: 0.12em; margin-bottom: 0.4rem;
  `;

  const title = document.createElement('h2');
  title.style.cssText = 'margin: 0 0 0.6rem; color: #d4a050; font-size: 1.4rem; line-height: 1.2;';

  const body = document.createElement('p');
  body.style.cssText = 'margin: 0 0 1.2rem; color: #d8cca8; font-style: italic; line-height: 1.5;';

  const triggers = document.createElement('div');
  triggers.style.cssText = 'margin-bottom: 1.2rem; font-size: 0.85rem; color: #90c090;';

  const button = document.createElement('button');
  button.textContent = 'Continue';
  button.style.cssText = `
    background: #5a4530; color: #f0e4c8; border: 1px solid #8a6a45;
    padding: 0.45rem 1.4rem; font-family: inherit; font-size: 0.95rem;
    cursor: pointer; float: right;
  `;
  button.addEventListener('click', () => cb.onDismiss(getWorld()));

  panel.append(act, title, body, triggers, button);
  overlay.append(panel);

  return {
    root: overlay,
    update(world) {
      const m = pendingMilestone(world);
      if (!m) {
        overlay.style.display = 'none';
        return;
      }
      act.textContent = `Day ${m.day} · Act ${m.act}: ${ACT_LABEL[m.act]}`;
      title.textContent = m.title;
      body.textContent = m.body;

      // Surface the gameplay impact so the player knows what changed.
      const fx: string[] = [];
      const t = m.triggers;
      if (t?.moraleDelta) fx.push(`${t.moraleDelta > 0 ? '+' : ''}${t.moraleDelta} morale`);
      if (t?.foodDelta) fx.push(`${t.foodDelta > 0 ? '+' : ''}${t.foodDelta} food`);
      if (t?.unlocksRelief) fx.push('Relief sighted — the besiegers waver');
      triggers.textContent = fx.join(' · ');
      triggers.style.display = fx.length === 0 ? 'none' : 'block';

      overlay.style.display = 'flex';
    },
  };
}

export { dismissPendingMilestone };
