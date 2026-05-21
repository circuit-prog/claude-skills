import type { World } from '../world/world.ts';
import type { Camera } from './camera.ts';
import { visibleTileBounds } from './camera.ts';
import { CONFIG } from '../data/config.ts';
import { tileIndex } from '../world/tilemap.ts';
import type { Terrain } from '../world/tilemap.ts';
import type { BuildingKind, DutyKind, UnitKind } from '../ecs/components.ts';
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

const SOLDIER_DUTY_COLORS: Record<DutyKind, string> = {
  reserve:   '#5a90c0',
  wall:      '#3070b0',
  gatehouse: '#3070b0',
  sally:     '#80a0d0',
  watch:     '#c0a050',
};

const SOLDIER_RANK_BAR: Record<UnitKind, string> = {
  'peasant-levy': '#9a8e74',
  spearman:       '#b0c0d0',
  crossbowman:    '#a0e0a0',
  'men-at-arms':  '#e0d060',
  knight:         '#e08040',
  mercenary:      '#a07060',
};

export function drawSoldiers(ctx: CanvasRenderingContext2D, world: World, cam: Camera): void {
  const ts = CONFIG.tileSize;
  const { x0, y0, x1, y1 } = visibleTileBounds(cam);
  for (const [id, soldier] of world.components.soldier.map) {
    const pos = getComponent(world.components.position, id);
    if (!pos) continue;
    if (pos.x < x0 - 1 || pos.x > x1 + 1 || pos.y < y0 - 1 || pos.y > y1 + 1) continue;
    const duty = getComponent(world.components.duty, id);
    const hp = getComponent(world.components.health, id);

    const px = pos.x * ts + 8;
    const py = pos.y * ts + 8;
    const size = ts - 16;

    // Soldier square colored by duty.
    ctx.fillStyle = SOLDIER_DUTY_COLORS[duty?.kind ?? 'reserve'];
    ctx.fillRect(px, py, size, size);

    // Rank stripe along the top.
    ctx.fillStyle = SOLDIER_RANK_BAR[soldier.unit];
    ctx.fillRect(px, py, size, 3);

    if (hp && hp.hp < hp.max) drawHpBar(ctx, px, py + size + 1, size, hp.hp / hp.max);
  }
}

export function drawEnemies(ctx: CanvasRenderingContext2D, world: World, cam: Camera): void {
  const ts = CONFIG.tileSize;
  const { x0, y0, x1, y1 } = visibleTileBounds(cam);
  for (const [id] of world.components.enemy.map) {
    const pos = getComponent(world.components.position, id);
    if (!pos) continue;
    if (pos.x < x0 - 1 || pos.x > x1 + 1 || pos.y < y0 - 1 || pos.y > y1 + 1) continue;
    const hp = getComponent(world.components.health, id);
    const cx = pos.x * ts + ts / 2;
    const cy = pos.y * ts + ts / 2;
    const r = ts / 2 - 6;

    ctx.fillStyle = '#a02020';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#400808';
    ctx.lineWidth = 1.5 / cam.zoom;
    ctx.stroke();

    if (hp && hp.hp < hp.max) drawHpBar(ctx, cx - r, cy + r + 1, r * 2, hp.hp / hp.max);
  }
}

function drawHpBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number): void {
  const h = 2;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = frac > 0.5 ? '#80c080' : frac > 0.25 ? '#d4a050' : '#e06060';
  ctx.fillRect(x, y, w * frac, h);
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
