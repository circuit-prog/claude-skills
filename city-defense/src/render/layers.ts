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

// ─── City decoration layer ─────────────────────────────────────────────────
//
// The placed-building entities (keep, walls, civic buildings, farms) are the
// gameplay layer — they have HP, can be attacked, can be built. To match the
// dense medieval-map look, we paint hundreds of tiny non-gameplay houses on
// top of every empty city-zone tile. Stable seed per tile so the pattern
// doesn't shimmer between frames.

interface CityZone {
  xMin: number; xMax: number; yMin: number; yMax: number;
  density: number;     // 0..1 — controls how many roofs per tile
}

const CITY_ZONES: CityZone[] = [
  // The walled core (Middle Town / The Brooks / Dark Hall) — densest
  { xMin: 32, xMax: 48, yMin: 22, yMax: 38, density: 1.0 },
  // The Brooks sprawl outside the west wall
  { xMin: 20, xMax: 31, yMin: 22, yMax: 38, density: 0.75 },
  // Middle Town sprawl outside the east wall (before the farms start)
  { xMin: 49, xMax: 53, yMin: 22, yMax: 38, density: 0.75 },
  // Northern Slums — between river and the city
  { xMin: 28, xMax: 52, yMin: 5, yMax: 21, density: 0.55 },
  // Dark Hall / Southern Slums — south of the wall
  { xMin: 28, xMax: 52, yMin: 39, yMax: 50, density: 0.55 },
  { xMin: 30, xMax: 50, yMin: 51, yMax: 56, density: 0.3 },
];

function cityZoneFor(x: number, y: number): CityZone | null {
  for (const z of CITY_ZONES) {
    if (x >= z.xMin && x <= z.xMax && y >= z.yMin && y <= z.yMax) return z;
  }
  return null;
}

// Roof palette — dark slate-blues and browns matching the inspiration.
const ROOF_COLORS = ['#2a2a3a', '#33282a', '#3a3024', '#262430', '#2a1c1c', '#382e26'];

export function drawCityDecorations(ctx: CanvasRenderingContext2D, world: World, cam: Camera): void {
  // Skip when too zoomed-out — at 2px-per-tile every roof would be one pixel
  // and the visual just becomes noise. Below 0.3 zoom we hide the layer.
  if (cam.zoom < 0.3) return;
  const ts = CONFIG.tileSize;
  const { x0, y0, x1, y1 } = visibleTileBounds(cam);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const zone = cityZoneFor(x, y);
      if (!zone) continue;
      const tIdx = tileIndex(world.tilemap, x, y);
      const terrain = world.tilemap.terrain[tIdx]!;
      // Decorations only sit on grass/dirt — let roads and water show through.
      if (terrain !== 'grass' && terrain !== 'dirt') continue;
      // Skip tiles occupied by a real (gameplay) building.
      if (world.tilemap.buildingAt[tIdx] !== null) continue;

      drawTileRoofs(ctx, x, y, ts, zone.density);
    }
  }
}

function drawTileRoofs(ctx: CanvasRenderingContext2D, tx: number, ty: number, ts: number, density: number): void {
  // Tile-coord seeded LCG so the same tile draws the same roofs every frame.
  let seed = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
  const rand = () => {
    seed = ((seed * 1664525 + 1013904223) >>> 0);
    return seed / 0x1_0000_0000;
  };

  // Faint parchment wash so the city tiles read as a slightly lighter
  // base under the dense roof clusters — mimics the inspiration's
  // cream-coloured city footprint against the dark-green countryside.
  ctx.fillStyle = 'rgba(220, 200, 160, 0.12)';
  ctx.fillRect(tx * ts, ty * ts, ts, ts);

  const count = Math.floor(4 + density * 7);
  const px = tx * ts;
  const py = ty * ts;

  for (let i = 0; i < count; i++) {
    // Mostly small roofs (3–5 px), occasional larger ones (up to 7).
    const bw = 3 + Math.floor(rand() * (rand() < 0.85 ? 3 : 5));
    const bh = 3 + Math.floor(rand() * (rand() < 0.85 ? 3 : 5));
    const bx = px + 1 + Math.floor(rand() * Math.max(1, ts - bw - 2));
    const by = py + 1 + Math.floor(rand() * Math.max(1, ts - bh - 2));

    ctx.fillStyle = ROOF_COLORS[Math.floor(rand() * ROOF_COLORS.length)]!;
    ctx.fillRect(bx, by, bw, bh);

    // Sunlit ridge along the top so the rooflets read as 3D.
    ctx.fillStyle = 'rgba(200, 170, 130, 0.32)';
    ctx.fillRect(bx, by, bw, 1);
  }
}

// Building draws are dispatched per-kind in drawBuildings; this colour table
// only feeds the under-construction outline.
const BUILDING_OUTLINE_COLORS: Record<BuildingKind, string> = {
  keep:      '#a09080',
  house:     '#c0a080',
  farm:      '#a08050',
  warehouse: '#8a6840',
  wall:      '#8a8a80',
  tower:     '#9a9a90',
  gatehouse: '#9a9a90',
  barracks:  '#8a8068',
  tavern:    '#9a7050',
  chapel:    '#d0c8a8',
  market:    '#a08868',
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

    if (building.state === 'ruined') { drawRubble(ctx, px, py, ts); return; }

    if (building.state === 'planned' || building.state === 'building') {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
      ctx.strokeStyle = BUILDING_OUTLINE_COLORS[building.kind];
      ctx.lineWidth = 1.5 / cam.zoom;
      ctx.strokeRect(px + 2, py + 2, ts - 4, ts - 4);
      return;
    }

    drawByKind(ctx, building.kind, px, py, ts);

    if (building.state === 'damaged') {
      ctx.strokeStyle = '#e06040';
      ctx.lineWidth = 1.5 / cam.zoom;
      ctx.strokeRect(px + 2, py + 2, ts - 4, ts - 4);
    }
  });
}

function drawByKind(ctx: CanvasRenderingContext2D, kind: BuildingKind, px: number, py: number, ts: number): void {
  switch (kind) {
    case 'house':     return drawHouse(ctx, px, py, ts);
    case 'farm':      return drawFarm(ctx, px, py, ts);
    case 'warehouse': return drawWarehouse(ctx, px, py, ts);
    case 'wall':      return drawWall(ctx, px, py, ts);
    case 'tower':     return drawTower(ctx, px, py, ts);
    case 'gatehouse': return drawGatehouse(ctx, px, py, ts);
    case 'barracks':  return drawBarracks(ctx, px, py, ts);
    case 'tavern':    return drawTavern(ctx, px, py, ts);
    case 'chapel':    return drawChapel(ctx, px, py, ts);
    case 'market':    return drawMarket(ctx, px, py, ts);
    case 'keep':      return drawKeep(ctx, px, py, ts);
  }
}

// Each building is rendered as a small medieval shape inside its tile. The
// shapes are simple geometry so they read clearly even when zoomed out, and
// hint at function (cross for chapel, banner for barracks, awnings for
// market, gate for gatehouse, etc.).

function drawHouse(ctx: CanvasRenderingContext2D, px: number, py: number, ts: number): void {
  const x = px + 5, y = py + 5, w = ts - 10, h = ts - 10;
  // Wattle-and-daub walls
  ctx.fillStyle = '#c0a080';
  ctx.fillRect(x, y + h * 0.45, w, h * 0.55);
  // Steep thatch / tile roof
  ctx.fillStyle = '#7a3a28';
  ctx.beginPath();
  ctx.moveTo(x - 1, y + h * 0.45);
  ctx.lineTo(x + w / 2, y - 1);
  ctx.lineTo(x + w + 1, y + h * 0.45);
  ctx.closePath();
  ctx.fill();
  // Door
  ctx.fillStyle = '#3a1a10';
  ctx.fillRect(x + w * 0.42, y + h * 0.7, w * 0.18, h * 0.3);
  // Outline so it pops on dark terrain
  ctx.strokeStyle = '#3a201a';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y + h * 0.45, w, h * 0.55);
}

function drawFarm(ctx: CanvasRenderingContext2D, px: number, py: number, ts: number): void {
  const x = px + 3, y = py + 3, w = ts - 6, h = ts - 6;
  // Plowed earth base
  ctx.fillStyle = '#9a7048';
  ctx.fillRect(x, y, w, h);
  // Crop rows
  ctx.strokeStyle = '#5a3818';
  ctx.lineWidth = 1;
  for (let i = 3; i < w; i += 4) {
    ctx.beginPath();
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i, y + h);
    ctx.stroke();
  }
  // Outline
  ctx.strokeStyle = '#3a2010';
  ctx.strokeRect(x, y, w, h);
}

function drawWarehouse(ctx: CanvasRenderingContext2D, px: number, py: number, ts: number): void {
  const x = px + 3, y = py + 3, w = ts - 6, h = ts - 6;
  // Big wooden building
  ctx.fillStyle = '#8a6840';
  ctx.fillRect(x, y, w, h);
  // Roof strip along the top
  ctx.fillStyle = '#5a3820';
  ctx.fillRect(x, y, w, h * 0.18);
  // Large double door
  ctx.fillStyle = '#2a1a10';
  ctx.fillRect(x + w * 0.28, y + h * 0.35, w * 0.44, h * 0.65);
  // Hinge strips
  ctx.fillStyle = '#5a3820';
  ctx.fillRect(x + w * 0.28, y + h * 0.35, 2, h * 0.65);
  ctx.fillRect(x + w * 0.72 - 2, y + h * 0.35, 2, h * 0.65);
  // Outline
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

function drawWall(ctx: CanvasRenderingContext2D, px: number, py: number, ts: number): void {
  const x = px + 2, y = py + 2, w = ts - 4, h = ts - 4;
  // Stone block
  ctx.fillStyle = '#9a948a';
  ctx.fillRect(x, y, w, h);
  // Crenellation strip top and bottom
  ctx.fillStyle = '#5a544a';
  const merlonW = w / 8;
  for (let i = 0; i < 4; i++) {
    const mx = x + i * (w / 4);
    ctx.fillRect(mx, y - 1, merlonW, 4);
    ctx.fillRect(mx, y + h - 3, merlonW, 4);
  }
  // Outline
  ctx.strokeStyle = '#3a342a';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

function drawTower(ctx: CanvasRenderingContext2D, px: number, py: number, ts: number): void {
  const x = px + 2, y = py + 2, w = ts - 4, h = ts - 4;
  // Tower base, slightly darker than walls
  ctx.fillStyle = '#a8a298';
  ctx.fillRect(x, y, w, h);
  // Battlements all around
  ctx.fillStyle = '#5a544a';
  const merlonW = w / 10;
  for (let i = 0; i < 5; i++) {
    const mx = x + i * (w / 5);
    ctx.fillRect(mx, y - 1, merlonW, 4);
    ctx.fillRect(mx, y + h - 3, merlonW, 4);
  }
  for (let i = 0; i < 5; i++) {
    const my = y + i * (h / 5);
    ctx.fillRect(x - 1, my, 4, merlonW);
    ctx.fillRect(x + w - 3, my, 4, merlonW);
  }
  // Inner courtyard
  ctx.fillStyle = '#6a5a48';
  ctx.fillRect(x + w * 0.3, y + h * 0.3, w * 0.4, h * 0.4);
  // Flag pole + pennant
  ctx.fillStyle = '#3a2818';
  ctx.fillRect(x + w / 2 - 1, y + h * 0.25, 2, h * 0.5);
  ctx.fillStyle = '#c04040';
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + h * 0.28);
  ctx.lineTo(x + w / 2 + 5, y + h * 0.32);
  ctx.lineTo(x + w / 2, y + h * 0.36);
  ctx.closePath();
  ctx.fill();
  // Outline
  ctx.strokeStyle = '#3a342a';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

function drawGatehouse(ctx: CanvasRenderingContext2D, px: number, py: number, ts: number): void {
  const x = px + 2, y = py + 2, w = ts - 4, h = ts - 4;
  // Two flanking towers
  ctx.fillStyle = '#a8a298';
  ctx.fillRect(x, y, w * 0.3, h);
  ctx.fillRect(x + w * 0.7, y, w * 0.3, h);
  // Gate (dark archway between)
  ctx.fillStyle = '#2a1a10';
  ctx.fillRect(x + w * 0.3, y + h * 0.15, w * 0.4, h * 0.85);
  // Portcullis bars
  ctx.strokeStyle = '#5a4630';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3 + i * (w * 0.4 / 4), y + h * 0.15);
    ctx.lineTo(x + w * 0.3 + i * (w * 0.4 / 4), y + h);
    ctx.stroke();
  }
  // Battlements on the two towers
  ctx.fillStyle = '#5a544a';
  ctx.fillRect(x, y - 1, w * 0.06, 4);
  ctx.fillRect(x + w * 0.12, y - 1, w * 0.06, 4);
  ctx.fillRect(x + w * 0.24, y - 1, w * 0.06, 4);
  ctx.fillRect(x + w * 0.7, y - 1, w * 0.06, 4);
  ctx.fillRect(x + w * 0.82, y - 1, w * 0.06, 4);
  ctx.fillRect(x + w * 0.94, y - 1, w * 0.06, 4);
  // Outline
  ctx.strokeStyle = '#3a342a';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

function drawBarracks(ctx: CanvasRenderingContext2D, px: number, py: number, ts: number): void {
  const x = px + 4, y = py + 4, w = ts - 8, h = ts - 8;
  // Stout walls
  ctx.fillStyle = '#8a8068';
  ctx.fillRect(x, y, w, h);
  // Crimson banner across the top
  ctx.fillStyle = '#a04030';
  ctx.fillRect(x, y, w, h * 0.22);
  // Three narrow windows in a row
  ctx.fillStyle = '#3a2a18';
  const winW = w * 0.15, winH = h * 0.28;
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x + (w - 3 * winW) / 4 + i * (winW + (w - 3 * winW) / 4), y + h * 0.5, winW, winH);
  }
  // Outline
  ctx.strokeStyle = '#3a2818';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

function drawTavern(ctx: CanvasRenderingContext2D, px: number, py: number, ts: number): void {
  const x = px + 5, y = py + 5, w = ts - 10, h = ts - 10;
  // Honey-coloured timber walls
  ctx.fillStyle = '#b08858';
  ctx.fillRect(x, y + h * 0.4, w, h * 0.6);
  // Brown roof
  ctx.fillStyle = '#5a3820';
  ctx.beginPath();
  ctx.moveTo(x - 1, y + h * 0.4);
  ctx.lineTo(x + w / 2, y - 1);
  ctx.lineTo(x + w + 1, y + h * 0.4);
  ctx.closePath();
  ctx.fill();
  // Wide door
  ctx.fillStyle = '#2a1a10';
  ctx.fillRect(x + w * 0.3, y + h * 0.55, w * 0.4, h * 0.45);
  // Sign hanging off the side
  ctx.fillStyle = '#3a281a';
  ctx.fillRect(x + w - 2, y + h * 0.5, 1, h * 0.18);
  ctx.fillStyle = '#c0a050';
  ctx.fillRect(x + w - 1, y + h * 0.55, 5, 6);
  // Outline
  ctx.strokeStyle = '#3a201a';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y + h * 0.4, w, h * 0.6);
}

function drawChapel(ctx: CanvasRenderingContext2D, px: number, py: number, ts: number): void {
  const x = px + 5, y = py + 4, w = ts - 10, h = ts - 8;
  // Pale stone walls
  ctx.fillStyle = '#d8d0b0';
  ctx.fillRect(x, y + h * 0.45, w, h * 0.55);
  // Steep dark roof
  ctx.fillStyle = '#5a2828';
  ctx.beginPath();
  ctx.moveTo(x - 1, y + h * 0.45);
  ctx.lineTo(x + w / 2, y + h * 0.05);
  ctx.lineTo(x + w + 1, y + h * 0.45);
  ctx.closePath();
  ctx.fill();
  // Spire
  ctx.fillStyle = '#5a2828';
  ctx.fillRect(x + w / 2 - 1, y - 2, 2, h * 0.2);
  // Cross
  ctx.fillStyle = '#f0e4c8';
  ctx.fillRect(x + w / 2 - 0.5, y - 4, 1.5, 5);
  ctx.fillRect(x + w / 2 - 2, y - 2, 5, 1.5);
  // Tall arched door
  ctx.fillStyle = '#2a1a10';
  ctx.fillRect(x + w * 0.42, y + h * 0.62, w * 0.16, h * 0.38);
  // Outline
  ctx.strokeStyle = '#3a302a';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y + h * 0.45, w, h * 0.55);
}

function drawMarket(ctx: CanvasRenderingContext2D, px: number, py: number, ts: number): void {
  const x = px + 3, y = py + 4, w = ts - 6, h = ts - 8;
  // Open paved court
  ctx.fillStyle = '#a08868';
  ctx.fillRect(x, y, w, h);
  // Three coloured awning strips
  const awningH = h * 0.35;
  const colors = ['#c04040', '#3a70a0', '#c0a040'];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = colors[i]!;
    ctx.fillRect(x + i * (w / 3), y, w / 3 - 1, awningH);
  }
  // Stall posts
  ctx.fillStyle = '#5a3820';
  for (let i = 0; i <= 3; i++) {
    ctx.fillRect(x + i * (w / 3) - 1, y + awningH, 2, h - awningH);
  }
  // Outline
  ctx.strokeStyle = '#3a2818';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

function drawKeep(ctx: CanvasRenderingContext2D, px: number, py: number, ts: number): void {
  const x = px + 1, y = py + 1, w = ts - 2, h = ts - 2;
  // Castle outer wall
  ctx.fillStyle = '#a89c88';
  ctx.fillRect(x, y, w, h);
  // Battlements outer
  ctx.fillStyle = '#5a4f40';
  const merlonW = w / 8;
  for (let i = 0; i < 4; i++) {
    const mx = x + i * (w / 4);
    ctx.fillRect(mx, y - 1, merlonW, 4);
    ctx.fillRect(mx, y + h - 3, merlonW, 4);
  }
  // Four corner towers
  ctx.fillStyle = '#807060';
  const tw = w * 0.22;
  ctx.fillRect(x, y, tw, tw);
  ctx.fillRect(x + w - tw, y, tw, tw);
  ctx.fillRect(x, y + h - tw, tw, tw);
  ctx.fillRect(x + w - tw, y + h - tw, tw, tw);
  // Central donjon
  ctx.fillStyle = '#6a5640';
  const dw = w * 0.36;
  ctx.fillRect(x + w / 2 - dw / 2, y + h / 2 - dw / 2, dw, dw);
  // Flagpole + crimson banner on the donjon
  ctx.fillStyle = '#2a1a10';
  ctx.fillRect(x + w / 2 - 1, y + h * 0.15, 2, h * 0.35);
  ctx.fillStyle = '#c04040';
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + h * 0.18);
  ctx.lineTo(x + w / 2 + 6, y + h * 0.23);
  ctx.lineTo(x + w / 2, y + h * 0.28);
  ctx.closePath();
  ctx.fill();
  // Outer outline
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
}

function drawRubble(ctx: CanvasRenderingContext2D, px: number, py: number, _ts: number): void {
  ctx.fillStyle = '#5a4838';
  ctx.fillRect(px + 6, py + 6, 4, 4);
  ctx.fillRect(px + 14, py + 9, 5, 4);
  ctx.fillRect(px + 22, py + 6, 3, 3);
  ctx.fillRect(px + 8, py + 18, 5, 5);
  ctx.fillRect(px + 18, py + 20, 4, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(px + 7, py + 7, 1, 1);
  ctx.fillRect(px + 16, py + 11, 1, 1);
  ctx.fillRect(px + 10, py + 20, 1, 1);
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
