import type { World } from '../world/world.ts';
import type { Camera } from './camera.ts';
import { visibleTileBounds } from './camera.ts';
import { CONFIG } from '../data/config.ts';
import { tileIndex } from '../world/tilemap.ts';
import type { Terrain } from '../world/tilemap.ts';
import type { BuildingKind, DutyKind, UnitKind } from '../ecs/components.ts';
import { each, getComponent } from '../ecs/store.ts';
import { DISTRICTS } from '../data/districts.ts';

// Parchment-toned palette inspired by the hand-drawn city-map look:
// muted olive grasses, sepia roads, slate-blue water, dark-olive forest,
// warm-grey stone. Tweak here to recolour the whole map.
// Brighter palette so the map reads clearly against the dark page bg.
const TERRAIN_COLORS: Record<Terrain, string> = {
  grass:    '#7a8a4a',
  dirt:     '#a08060',
  road:     '#d4bc8a',
  water:    '#6a8aa8',
  forest:   '#4a5a30',
  stone:    '#9a9488',
  farmland: '#b0a058',
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
      if (t === 'farmland') drawFarmlandHatch(ctx, x * ts, y * ts, ts, cam.zoom);
      else if (t === 'forest') drawForestSpeckles(ctx, x * ts, y * ts, ts, x + y);
      else if (t === 'water') drawWaterRipple(ctx, x * ts, y * ts, ts, x + y);
    }
  }
}

// Diagonal hatching gives farmland tiles the striped look from the
// reference map. Skipped when zoomed out — too noisy.
function drawFarmlandHatch(ctx: CanvasRenderingContext2D, x: number, y: number, ts: number, zoom: number): void {
  if (zoom < 0.7) return;
  ctx.strokeStyle = 'rgba(60, 60, 30, 0.35)';
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath();
  for (let i = -ts; i <= ts; i += 6) {
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i + ts, y + ts);
  }
  ctx.stroke();
}

// A few darker speckles on forest tiles to suggest tree clusters.
function drawForestSpeckles(ctx: CanvasRenderingContext2D, x: number, y: number, ts: number, seed: number): void {
  ctx.fillStyle = 'rgba(20, 30, 15, 0.55)';
  // Pseudo-random but deterministic per tile so the speckles don't shimmer
  // each render. Just bit-mash the seed.
  const r1 = ((seed * 9301) >>> 0) % (ts - 8);
  const r2 = ((seed * 49297) >>> 0) % (ts - 8);
  const r3 = ((seed * 233280) >>> 0) % (ts - 8);
  ctx.fillRect(x + 4 + r1, y + 4 + r2, 3, 3);
  ctx.fillRect(x + 6 + r3, y + 10 + r1, 3, 3);
  ctx.fillRect(x + 18 + r2, y + 18 + r3, 3, 3);
}

// A thin lighter line on water tiles every other column suggests ripples.
function drawWaterRipple(ctx: CanvasRenderingContext2D, x: number, y: number, ts: number, seed: number): void {
  if ((seed & 1) === 0) return;
  ctx.strokeStyle = 'rgba(180, 200, 220, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + ts / 2);
  ctx.lineTo(x + ts - 4, y + ts / 2);
  ctx.stroke();
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

// Faint district name labels overlaid on the map — uppercase, dark red,
// letter-spaced, serif. Mimics the look of an old hand-drawn city map.
export function drawDistrictLabels(ctx: CanvasRenderingContext2D, cam: Camera): void {
  // Below a certain zoom they become illegible and crowd the view; hide.
  if (cam.zoom < 0.55) return;
  const ts = CONFIG.tileSize;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(120, 50, 40, 0.72)';
  ctx.strokeStyle = 'rgba(245, 235, 210, 0.5)';
  for (const d of DISTRICTS) {
    const px = cam.viewportW / 2;       // placeholder — overwritten below
    void px;
    const fontPx = (d.size === 'large' ? 14 : d.size === 'small' ? 9 : 11) / cam.zoom;
    ctx.font = `bold ${fontPx}px Georgia, serif`;
    const text = letterSpace(d.name);
    const x = d.x * ts;
    const y = d.y * ts;
    ctx.lineWidth = 3 / cam.zoom;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}

// Add thin spaces between every letter — keeps the all-caps map-label look.
function letterSpace(s: string): string {
  return s.toUpperCase().split('').join(' ');     // U+2009 thin space
}

// Compass rose pinned to the lower-right of the visible viewport so it
// stays in screen space regardless of zoom/pan. Rendered AFTER the world
// transform is restored, so it takes plain pixel coords.
export function drawCompassRose(
  ctx: CanvasRenderingContext2D,
  viewportW: number, viewportH: number,
): void {
  const cx = viewportW - 60;
  const cy = viewportH - 80;
  const r = 26;
  ctx.save();
  // Background disc
  ctx.fillStyle = 'rgba(30, 22, 16, 0.72)';
  ctx.strokeStyle = '#8a6a45';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // N arrow (red)
  ctx.fillStyle = '#c04040';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r + 4);
  ctx.lineTo(cx - 5, cy);
  ctx.lineTo(cx + 5, cy);
  ctx.closePath();
  ctx.fill();
  // S arrow (cream)
  ctx.fillStyle = '#d4c08a';
  ctx.beginPath();
  ctx.moveTo(cx, cy + r - 4);
  ctx.lineTo(cx - 5, cy);
  ctx.lineTo(cx + 5, cy);
  ctx.closePath();
  ctx.fill();
  // E + W arms
  ctx.fillStyle = '#a08868';
  ctx.beginPath();
  ctx.moveTo(cx + r - 4, cy);
  ctx.lineTo(cx, cy - 4);
  ctx.lineTo(cx, cy + 4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - r + 4, cy);
  ctx.lineTo(cx, cy - 4);
  ctx.lineTo(cx, cy + 4);
  ctx.closePath();
  ctx.fill();

  // N label
  ctx.fillStyle = '#f0e4c8';
  ctx.font = 'bold 11px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', cx, cy - r - 8);
  ctx.restore();
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
