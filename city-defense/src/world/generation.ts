import type { Tilemap, Terrain } from './tilemap.ts';
import { setTerrain } from './tilemap.ts';
import type { RNG } from '../engine/rng.ts';
import { nextFloat, nextInt } from '../engine/rng.ts';

// Phase-1 terrain: a few scattered patches of forest, stone, and water
// so the map has variety to look at while pan/zoom/save/load are tested.
// Replaced later by a proper procedural pass once farms/resources matter.

export function generateTerrain(map: Tilemap, rng: RNG): void {
  scatterPatches(map, rng, 'forest', 6, 4, 9);
  scatterPatches(map, rng, 'stone',  4, 2, 5);
  scatterPatches(map, rng, 'water',  3, 5, 12);
  scatterPatches(map, rng, 'dirt',   8, 1, 3);
}

function scatterPatches(map: Tilemap, rng: RNG, t: Terrain, count: number, minR: number, maxR: number): void {
  for (let i = 0; i < count; i++) {
    const cx = nextInt(rng, map.width);
    const cy = nextInt(rng, map.height);
    const r = minR + nextInt(rng, maxR - minR + 1);
    paintBlob(map, rng, t, cx, cy, r);
  }
}

function paintBlob(map: Tilemap, rng: RNG, t: Terrain, cx: number, cy: number, r: number): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Noisy circular falloff for organic shapes.
      const noise = nextFloat(rng) * 0.6 - 0.3;
      if (dist + noise * r <= r) setTerrain(map, x, y, t);
    }
  }
}
