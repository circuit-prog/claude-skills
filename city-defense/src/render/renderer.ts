import type { World } from '../world/world.ts';
import type { Camera } from './camera.ts';
import { resizeCamera } from './camera.ts';
import { drawTerrain, drawGrid, drawBuildings, drawSoldiers, drawEnemies, drawHoverTile } from './layers.ts';

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cam: Camera;
  hoverTile?: { x: number; y: number; valid: boolean };
}

export function attachCanvas(canvas: HTMLCanvasElement, cam: Camera): RenderContext {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    resizeCamera(cam, canvas.clientWidth, canvas.clientHeight);
  }
  resize();
  window.addEventListener('resize', resize);

  return { canvas, ctx, cam };
}

export function render(rc: RenderContext, world: World): void {
  const { ctx, canvas, cam } = rc;
  const dpr = canvas.width / canvas.clientWidth;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // World transform: scale to DPR, then translate to camera centre, then zoom.
  ctx.scale(dpr, dpr);
  ctx.translate(cam.viewportW / 2, cam.viewportH / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.cx, -cam.cy);

  drawTerrain(ctx, world, cam);
  drawGrid(ctx, cam);
  drawBuildings(ctx, world, cam);
  drawSoldiers(ctx, world, cam);
  drawEnemies(ctx, world, cam);
  if (rc.hoverTile) {
    drawHoverTile(ctx, cam, rc.hoverTile.x, rc.hoverTile.y, rc.hoverTile.valid);
  }

  ctx.restore();
}
