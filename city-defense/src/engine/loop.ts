import type { World } from '../world/world.ts';
import { CONFIG } from '../data/config.ts';

export type SimulateFn = (world: World) => void;
export type RenderFn = (world: World, alpha: number) => void;

export interface LoopHandles {
  start(): void;
  stop(): void;
}

export function createLoop(world: World, simulate: SimulateFn, render: RenderFn): LoopHandles {
  let running = false;
  let acc = 0;
  let last = 0;
  let frameId = 0;

  const MAX_CATCHUP_TICKS = 30;

  function frame(now: number) {
    if (!running) return;
    const realDelta = now - last;
    last = now;
    acc += realDelta * world.speed;

    let steps = 0;
    while (acc >= CONFIG.tickMs && steps < MAX_CATCHUP_TICKS) {
      simulate(world);
      acc -= CONFIG.tickMs;
      steps += 1;
      if (world.gameOver) { acc = 0; break; }
    }
    if (steps >= MAX_CATCHUP_TICKS) acc = 0;

    const alpha = world.speed === 0 ? 0 : acc / CONFIG.tickMs;
    render(world, alpha);
    frameId = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      acc = 0;
      frameId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      if (frameId) cancelAnimationFrame(frameId);
    },
  };
}
