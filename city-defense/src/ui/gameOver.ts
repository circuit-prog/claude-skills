import type { World } from '../world/world.ts';

const TITLES: Record<NonNullable<World['gameOver']>['reason'], string> = {
  captured: 'The City Has Fallen',
  starved:  'Famine Has Broken the City',
  revolt:   'The People Have Risen',
  victory:  'You Have Held the City',
};

const SUBTITLES: Record<NonNullable<World['gameOver']>['reason'], string> = {
  captured: 'Enemy banners fly above the keep. The siege is ended.',
  starved:  'The grain ran out. The streets are quiet.',
  revolt:   'The mob has thrown open the gates. The captains will not stop them.',
  victory:  'Relief has arrived. Your name will be remembered.',
};

export interface GameOverScreen {
  show(world: World): void;
  hide(): void;
}

export function mountGameOver(root: HTMLElement, onRestart: () => void): GameOverScreen {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: absolute; inset: 0;
    background: rgba(0,0,0,0.75);
    display: none; align-items: center; justify-content: center;
    z-index: 10;
  `;

  const panel = document.createElement('div');
  panel.style.cssText = `
    background: #2a1f15; border: 1px solid #8a6a45;
    padding: 2rem 2.5rem; max-width: 32rem; text-align: center;
    color: #f0e4c8; font-family: inherit;
  `;

  const title = document.createElement('h1');
  title.style.cssText = 'margin: 0 0 0.5rem; color: #d4a050; font-size: 1.8rem;';

  const subtitle = document.createElement('p');
  subtitle.style.cssText = 'margin: 0 0 1.2rem; font-style: italic; color: #b0a080;';

  const stats = document.createElement('div');
  stats.style.cssText = 'margin-bottom: 1.5rem; color: #c0b090; font-size: 0.9rem;';

  const button = document.createElement('button');
  button.textContent = 'New Game';
  button.style.cssText = `
    background: #5a4530; color: #f0e4c8; border: 1px solid #8a6a45;
    padding: 0.5rem 1.5rem; font-family: inherit; font-size: 1rem; cursor: pointer;
  `;
  button.addEventListener('click', onRestart);

  panel.append(title, subtitle, stats, button);
  overlay.append(panel);
  root.append(overlay);

  return {
    show(world) {
      if (!world.gameOver) return;
      title.textContent = TITLES[world.gameOver.reason];
      subtitle.textContent = SUBTITLES[world.gameOver.reason];
      stats.innerHTML = [
        `Day ${world.gameOver.day} of ${world.daysToSurvive}`,
        `Population at end: ${world.population.total}`,
        `Starvation deaths: ${world.population.starvationDeaths}`,
        `Morale: ${Math.round(world.population.morale)}`,
      ].join(' &nbsp;·&nbsp; ');
      overlay.style.display = 'flex';
    },
    hide() {
      overlay.style.display = 'none';
    },
  };
}
