import type { World } from '../world/world.ts';
import { MILESTONES, actFor, ACT_LABEL } from '../data/milestones.ts';

// Slim day-progress bar fixed below the top resource bar. Shows the
// 0→daysToSurvive progress, the act we're in, and tick marks for every
// scripted milestone — past ones filled, future ones outlined.
export interface ProgressBar {
  root: HTMLElement;
  update(world: World): void;
}

export function mountProgressBar(): ProgressBar {
  const root = document.createElement('div');
  root.style.cssText = `
    position: absolute; top: 3rem; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,0.7); border: 1px solid #3a2a1a;
    padding: 0.3rem 0.7rem; font-size: 0.8rem;
    display: flex; flex-direction: column; gap: 0.25rem;
    width: 32rem; pointer-events: none;
  `;

  const header = document.createElement('div');
  header.style.cssText = 'display:flex; justify-content: space-between; color: #c0b090; font-size: 0.75rem;';
  const headerLeft = document.createElement('span');
  const headerRight = document.createElement('span');
  headerRight.style.color = '#d4a050';
  header.append(headerLeft, headerRight);
  root.append(header);

  // Track
  const track = document.createElement('div');
  track.style.cssText = `
    position: relative; height: 6px; background: #1a1410;
    border: 1px solid #5a4530;
  `;
  const fill = document.createElement('div');
  fill.style.cssText = `
    position: absolute; left: 0; top: 0; bottom: 0;
    background: linear-gradient(90deg, #5a4530 0%, #d4a050 100%);
  `;
  track.append(fill);
  root.append(track);

  // Milestone tick marks
  const ticks: HTMLElement[] = [];
  for (const m of MILESTONES) {
    const tick = document.createElement('div');
    tick.style.cssText = `
      position: absolute; top: -2px; bottom: -2px;
      width: 2px; background: #b09060;
    `;
    tick.title = `Day ${m.day}: ${m.title}`;
    track.append(tick);
    ticks.push(tick);
  }

  return {
    root,
    update(world) {
      const cap = world.daysToSurvive;
      const day = Math.min(world.day, cap);
      const pct = (day / cap) * 100;
      fill.style.width = `${pct}%`;

      const act = actFor(world.day);
      headerLeft.textContent = `Day ${world.day} of ${cap}`;
      if (world.phase === 'preparation') {
        headerRight.textContent = `Siege begins in ${world.daysUntilSiege}d`;
      } else if (world.reliefUnlocked) {
        headerRight.textContent = `Act ${act}: Relief Sighted`;
      } else {
        headerRight.textContent = `Act ${act}: ${ACT_LABEL[act]}`;
      }

      // Position milestone ticks based on percentage along the bar.
      for (let i = 0; i < MILESTONES.length; i++) {
        const m = MILESTONES[i]!;
        const tick = ticks[i]!;
        tick.style.left = `${(m.day / cap) * 100}%`;
        const reached = world.firedMilestones.includes(m.id);
        tick.style.background = reached ? '#d4a050' : '#6a5a3a';
        tick.style.opacity = reached ? '1' : '0.6';
      }
    },
  };
}
