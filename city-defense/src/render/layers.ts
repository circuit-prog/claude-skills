import type { World } from '../world/world.ts';
import type { Camera } from './camera.ts';
import { visibleTileBounds } from './camera.ts';
import { CONFIG } from '../data/config.ts';
import { tileIndex } from '../world/tilemap.ts';
import type { Terrain } from '../world/tilemap.ts';
import type { BuildingKind } from '../ecs/components.ts';
import { each, getComponent } from '../ecs/store.ts';

const TERRAIN_COLORS: Record<Terrain, string> = {
  grass:    '#4a6a3a',
  dirt:     '#7a5a3a',
  road:     '#8a7a5a',
  water:    '#3a5a7a',
  forest:   '#2a4a2a',
  stone:    '#6a6a6a',
  farmland: '#8a7a4a',
};

const BUILDING_COLORS: Record<BuildingKind, string> = {
  keep:      '#8a3a3a',
  house:     '#a07050',
  farm:      '#b09040',
  warehouse: '#806040',
  wall:      '#606060',
  tower:     '#7a7a7a',
  gatehouse: '#9a9a9a',
  barracks:  '#6a5a5a',
  tavern:    '#a04030',
  chapel:    '#c0a070',
  market:    '#a08050',
};

export function drawTerrain(ctx: CanvasRenderingContext2D, world: World, cam: Camera): void {
  const { x0, y0, x1, y1 } = visibleTileBounds(cam);
  const ts = CONFIG.tileSize;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = world.tilemap.terrain[tileIndex(world.tilemap, x, y)]!;
      ctx.fillStyle = TERRAIN_COLORS[t];
      ctx.fillRect(x * ts, y * ts, ts, ts);
    }
  }
}

export function drawGrid(ctx: CanvasRenderingContext2D, cam: Camera): void {
  if (cam.zoom < 0.7) return;
  const { x0, y0, x1, y1 } = visibleTileBounds(cam);
  const ts = CONFIG.tileSize;
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1 / cam.zoom;
  ctx.beginPath();
  for (let x = x0; x <= x1 + 1; x++) {
    ctx.moveTo(x * ts, y0 * ts);
    ctx.lineTo(x * ts, (y1 + 1) * ts);
  }
  for (let y = y0; y <= y1 + 1; y++) {
    ctx.moveTo(x0 * ts, y * ts);
    ctx.lineTo((x1 + 1) * ts, y * ts);
  }
  ctx.stroke();
}

export function drawBuildings(ctx: CanvasRenderingContext2D, world: World, cam: Camera): void {
  const ts = CONFIG.tileSize;
  const { x0, y0, x1, y1 } = visibleTileBounds(cam);
  each(world.components.building, (id, building) => {
    const pos = getComponent(world.components.position, id);
    if (!pos) return;
    if (pos.x < x0 - 1 || pos.x > x1 + 1 || pos.y < y0 - 1 || pos.y > y1 + 1) return;

    const px = pos.x * ts;
    const py = pos.y * ts;

    if (building.state === 'planned' || building.state === 'building') {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
      ctx.strokeStyle = '#d4a050';
      ctx.lineWidth = 1.5 / cam.zoom;
      ctx.strokeRect(px + 2, py + 2, ts - 4, ts - 4);
      return;
    }

    ctx.fillStyle = BUILDING_COLORS[building.kind];
    ctx.fillRect(px + 3, py + 3, ts - 6, ts - 6);

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(px + 3, py + ts - 8, ts - 6, 5);

    if (building.state === 'damaged') {
      ctx.strokeStyle = '#d04040';
      ctx.lineWidth = 1.5 / cam.zoom;
      ctx.strokeRect(px + 3, py + 3, ts - 6, ts - 6);
    }
  });
}

export function drawHoverTile(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  tx: number, ty: number,
  valid: boolean,
): void {
  const ts = CONFIG.tileSize;
  ctx.fillStyle = valid ? 'rgba(120,200,120,0.35)' : 'rgba(200,80,80,0.35)';
  ctx.fillRect(tx * ts, ty * ts, ts, ts);
  ctx.strokeStyle = valid ? '#a0e0a0' : '#e0a0a0';
  ctx.lineWidth = 2 / cam.zoom;
  ctx.strokeRect(tx * ts + 1, ty * ts + 1, ts - 2, ts - 2);
}
