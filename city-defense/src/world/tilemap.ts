export type Terrain = 'grass' | 'dirt' | 'road' | 'water' | 'forest' | 'stone' | 'farmland';

export interface Tilemap {
  width: number;
  height: number;
  terrain: Terrain[];          // length = width * height (row-major)
  buildingAt: (number | null)[]; // EntityId of building occupying tile, or null
}

export function createTilemap(width: number, height: number, fill: Terrain = 'grass'): Tilemap {
  const len = width * height;
  return {
    width,
    height,
    terrain: new Array(len).fill(fill),
    buildingAt: new Array(len).fill(null),
  };
}

export function tileIndex(map: Tilemap, x: number, y: number): number {
  return y * map.width + x;
}

export function inBounds(map: Tilemap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

export function getTerrain(map: Tilemap, x: number, y: number): Terrain | null {
  if (!inBounds(map, x, y)) return null;
  return map.terrain[tileIndex(map, x, y)] ?? null;
}

export function setTerrain(map: Tilemap, x: number, y: number, t: Terrain): void {
  if (!inBounds(map, x, y)) return;
  map.terrain[tileIndex(map, x, y)] = t;
}

export function getBuildingAt(map: Tilemap, x: number, y: number): number | null {
  if (!inBounds(map, x, y)) return null;
  return map.buildingAt[tileIndex(map, x, y)] ?? null;
}

export function setBuildingAt(map: Tilemap, x: number, y: number, id: number | null): void {
  if (!inBounds(map, x, y)) return;
  map.buildingAt[tileIndex(map, x, y)] = id;
}
