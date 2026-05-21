import type { World } from '../world/world.ts';
import type { Camera } from './camera.ts';
import { resizeCamera, fitZoomFor } from './camera.ts';
import {
  drawTerrain, drawGrid, drawCityDecorations, drawBuildings,
  drawSoldiers, drawEnemies, drawHoverTile, drawDistrictLabels, drawCompassRose,
} from './layers.ts';

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cam: Camera;
  hoverTile?: { x: number; y: number; valid: boolean };
}

export function attachCanvas(canvas: HTMLCanvasElement, cam: Camera): RenderContext {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  let firstValidResize = true;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    resizeCamera(cam, canvas.clientWidth, canvas.clientHeight);
    // Re-fit the zoom the first time we get a real viewport — createCamera
    // may have been called before layout (clientWidth === 0).
    if (firstValidResize && canvas.clientWidth > 0 && canvas.clientHeight > 0) {
      cam.zoom = fitZoomFor(canvas.clientWidth, canvas.clientHeight);
      firstValidResize = false;
    }
  }
  resize();
  // Also re-resize on the next animation frame in case the canvas wasn't
  // yet laid out when this module loaded.
  requestAnimationFrame(resize);
  window.addEventListener('resize', resize);

  return { canvas, ctx, cam };
}

export function render(rc: RenderContext, world: World): void {
  const { ctx, canvas, cam } = rc;
  // Defensive: a 0-size canvas (first render before layout settles) makes
  // dpr = NaN and ctx.scale silently break. Skip until the canvas has size.
  if (canvas.width === 0 || canvas.height === 0 || canvas.clientWidth === 0) {
    return;
  }
  const dpr = canvas.width / canvas.clientWidth;
  if (!Number.isFinite(dpr) || dpr <= 0) return;

  try {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Page-distinct background so a blank canvas is obviously distinguishable
    // from "not rendering at all" — players can tell something is alive.
    ctx.fillStyle = '#0f0a06';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // World transform: scale to DPR, then translate to camera centre, then zoom.
    ctx.scale(dpr, dpr);
    ctx.translate(cam.viewportW / 2, cam.viewportH / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.cx, -cam.cy);

    drawTerrain(ctx, world, cam);
    drawCityDecorations(ctx, world, cam);
    drawGrid(ctx, cam);
    drawDistrictLabels(ctx, cam);
    drawBuildings(ctx, world, cam);
    drawSoldiers(ctx, world, cam);
    drawEnemies(ctx, world, cam);
    if (rc.hoverTile) {
      drawHoverTile(ctx, cam, rc.hoverTile.x, rc.hoverTile.y, rc.hoverTile.valid);
    }

    ctx.restore();

    // Screen-space overlays. After restore() the matrix is back to identity;
    // re-apply DPR scale so the compass rose lands at the right pixels and
    // stays crisp on high-DPI displays.
    ctx.save();
    ctx.scale(dpr, dpr);
    drawCompassRose(ctx, cam.viewportW, cam.viewportH);
    ctx.restore();
  } catch (err) {
    // Don't let a single bad frame kill the loop — log once and keep going.
    console.error('render failed:', err);
    ctx.restore();
  }
}
