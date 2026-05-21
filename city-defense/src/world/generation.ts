import type { Tilemap, Terrain } from './tilemap.ts';
import { setTerrain, getTerrain, inBounds } from './tilemap.ts';
import type { RNG } from '../engine/rng.ts';
import { nextFloat, nextInt } from '../engine/rng.ts';

// Structured medieval-city generation. Layout (looking down on the map):
//
//   ┌──────────────────┐     ←─ Row 0: river (water) running east-west
//   │~~~~~~ ‖ ~~~~~~~~ │        with a bridge at column 40
//   │                  │
//   │   forest    ROAD │
//   │     ── ROAD ──── │     ←─ centre roads radiating from the keep
//   │  forest │ farms  │        farmland to the east, forest/stone to west
//   │           orch.  │
//   │   road↓          │
//   └──────────────────┘
//
// The centre stays clear so the player can place buildings around the keep.

const RIVER_ROWS = 3;            // how many tile rows the river covers
const BRIDGE_WIDTH = 2;          // tiles wide for the bridge crossing

export function generateTerrain(map: Tilemap, rng: RNG): void {
  paintRiver(map);
  paintFarmland(map, rng);
  paintForest(map, rng);
  paintStoneQuarry(map, rng);
  paintRoads(map);
}

// ─── River + bridge ──────────────────────────────────────────────────────

function paintRiver(map: Tilemap): void {
  const bridgeCol = Math.floor(map.width / 2);
  for (let y = 0; y < RIVER_ROWS; y++) {
    for (let x = 0; x < map.width; x++) {
      setTerrain(map, x, y, 'water');
    }
  }
  // Carve the bridge across the river with road/dirt tiles.
  for (let y = 0; y <= RIVER_ROWS; y++) {
    for (let dx = 0; dx < BRIDGE_WIDTH; dx++) {
      setTerrain(map, bridgeCol + dx - 1, y, 'road');
    }
  }
}

// ─── Farmland to the east ────────────────────────────────────────────────

function paintFarmland(map: Tilemap, rng: RNG): void {
  // A large band of farmland tiles in the eastern third of the map, broken
  // up by occasional dirt tracks. This is the food bowl.
  const farmStartX = Math.floor(map.width * 0.62);
  const farmEndX = map.width - 2;
  const farmStartY = RIVER_ROWS + 4;
  const farmEndY = map.height - 4;
  for (let y = farmStartY; y <= farmEndY; y++) {
    for (let x = farmStartX; x <= farmEndX; x++) {
      // Leave gaps so it isn't a solid block.
      if (nextFloat(rng) < 0.92) setTerrain(map, x, y, 'farmland');
    }
  }
  // A track running north-south through the farmland.
  const trackX = farmStartX + 4;
  for (let y = farmStartY; y <= farmEndY; y++) setTerrain(map, trackX, y, 'dirt');
}

// ─── Forest patches in the west and south ────────────────────────────────

function paintForest(map: Tilemap, rng: RNG): void {
  scatterPatches(map, rng, 'forest', 5, 4, 8, { xMin: 2, xMax: 22, yMin: RIVER_ROWS + 4, yMax: map.height - 2 });
  scatterPatches(map, rng, 'forest', 3, 3, 6, { xMin: 25, xMax: 48, yMin: map.height - 12, yMax: map.height - 2 });
}

// ─── Stone outcrop south-west (where the player can quarry) ──────────────

function paintStoneQuarry(map: Tilemap, rng: RNG): void {
  scatterPatches(map, rng, 'stone', 2, 2, 4, { xMin: 8, xMax: 22, yMin: map.height - 18, yMax: map.height - 6 });
  scatterPatches(map, rng, 'dirt',  6, 1, 3, { xMin: 4, xMax: map.width - 4, yMin: RIVER_ROWS + 3, yMax: map.height - 4 });
}

// ─── Road network radiating from the keep ────────────────────────────────

function paintRoads(map: Tilemap): void {
  const keepX = Math.floor(map.width / 2);
  const keepY = Math.floor(map.height / 2);

  // North road from the keep to the bridge.
  for (let y = RIVER_ROWS; y <= keepY; y++) setTerrain(map, keepX, y, 'road');
  for (let y = RIVER_ROWS; y <= keepY; y++) setTerrain(map, keepX - 1, y, 'road');

  // South road to the southern slums.
  for (let y = keepY; y < map.height; y++) setTerrain(map, keepX, y, 'road');

  // East road into the farmland.
  for (let x = keepX; x < map.width; x++) setTerrain(map, x, keepY, 'road');

  // West road through the inner town.
  for (let x = 2; x <= keepX; x++) setTerrain(map, x, keepY, 'road');

  // South-east diagonal road (Light Garden) — starts outside the wall ring
  // so the inner streets stay clean for buildings.
  for (let s = 7; s < 7 + 14; s++) {
    setTerrain(map, keepX + s, keepY + s, 'road');
  }
  // South-west diagonal (Darkgate).
  for (let s = 7; s < 7 + 14; s++) {
    setTerrain(map, keepX - s, keepY + s, 'road');
  }
}

// ─── Patch-painting helper ───────────────────────────────────────────────

interface Region {
  xMin: number; xMax: number; yMin: number; yMax: number;
}

function scatterPatches(
  map: Tilemap, rng: RNG, t: Terrain,
  count: number, minR: number, maxR: number,
  region?: Region,
): void {
  const xMin = region?.xMin ?? 0;
  const xMax = region?.xMax ?? map.width - 1;
  const yMin = region?.yMin ?? 0;
  const yMax = region?.yMax ?? map.height - 1;
  for (let i = 0; i < count; i++) {
    const cx = xMin + nextInt(rng, xMax - xMin + 1);
    const cy = yMin + nextInt(rng, yMax - yMin + 1);
    const r = minR + nextInt(rng, maxR - minR + 1);
    paintBlob(map, rng, t, cx, cy, r);
  }
}

function paintBlob(map: Tilemap, rng: RNG, t: Terrain, cx: number, cy: number, r: number): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (!inBounds(map, x, y)) continue;
      // Never overwrite water (the river is sacred) or roads (which were
      // drawn last in the orchestrator, so this is defence-in-depth).
      const existing = getTerrain(map, x, y);
      if (existing === 'water' || existing === 'road') continue;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const noise = nextFloat(rng) * 0.6 - 0.3;
      if (dist + noise * r <= r) setTerrain(map, x, y, t);
    }
  }
}
