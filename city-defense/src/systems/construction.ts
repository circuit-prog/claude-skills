import type { World } from '../world/world.ts';
import { allocate } from '../ecs/store.ts';
import { setComponent, getComponent, each } from '../ecs/store.ts';
import type { BuildingKind, Building } from '../ecs/components.ts';
import { buildingDef } from '../data/buildings.ts';
import { getTerrain, getBuildingAt, setBuildingAt, inBounds } from '../world/tilemap.ts';
import { CONFIG } from '../data/config.ts';

export type PlaceResult =
  | { ok: true; entity: number }
  | { ok: false; reason: 'out-of-bounds' | 'invalid-terrain' | 'occupied' | 'insufficient-resources' };

export interface PlaceOptions {
  instant?: boolean;       // skip build queue (used for starting Keep)
  freeOfCost?: boolean;    // skip resource debit
}

export function placeBuilding(
  world: World,
  kind: BuildingKind,
  x: number, y: number,
  opts: PlaceOptions = {},
): PlaceResult {
  if (!inBounds(world.tilemap, x, y)) return { ok: false, reason: 'out-of-bounds' };
  const terrain = getTerrain(world.tilemap, x, y);
  const def = buildingDef(kind);
  if (!terrain || !def.validOn.includes(terrain)) return { ok: false, reason: 'invalid-terrain' };
  if (getBuildingAt(world.tilemap, x, y) !== null) return { ok: false, reason: 'occupied' };

  if (!opts.freeOfCost) {
    const r = world.resources;
    if (r.wood < def.cost.wood || r.stone < def.cost.stone || r.gold < def.cost.gold) {
      return { ok: false, reason: 'insufficient-resources' };
    }
    r.wood -= def.cost.wood;
    r.stone -= def.cost.stone;
    r.gold -= def.cost.gold;
  }

  const id = allocate(world.entities);
  setComponent(world.components.position, id, { x, y });

  const instant = opts.instant || def.buildTicks === 0;
  const b: Building = {
    kind,
    state: instant ? 'operational' : 'building',
    ticksRemaining: instant ? 0 : def.buildTicks,
    workersAssigned: 0,
  };
  setComponent(world.components.building, id, b);
  setComponent(world.components.health, id, { hp: def.maxHp, max: def.maxHp });
  setBuildingAt(world.tilemap, x, y, id);
  return { ok: true, entity: id };
}

export function advanceConstruction(world: World): void {
  each(world.components.building, (_, b) => {
    if (b.state !== 'building') return;
    b.ticksRemaining = Math.max(0, b.ticksRemaining - 1);
    if (b.ticksRemaining === 0) b.state = 'operational';
  });
}

export function removeBuilding(world: World, id: number): void {
  const pos = getComponent(world.components.position, id);
  if (pos) setBuildingAt(world.tilemap, pos.x, pos.y, null);
  world.components.position.map.delete(id);
  world.components.building.map.delete(id);
  world.components.health.map.delete(id);
}

// Pre-place a short wall segment along the north face of the keep's inner
// perimeter. Triggered by the Wall Engineer's startingWallSegments buff.
export function placeStartingWalls(world: World, segments: number): void {
  if (segments <= 0) return;
  const keepX = Math.floor(CONFIG.mapWidth / 2);
  const keepY = Math.floor(CONFIG.mapHeight / 2);
  const RING_RADIUS = 4;
  const top = keepY - RING_RADIUS;
  const left = keepX - Math.floor(segments / 2);
  for (let i = 0; i < segments; i++) {
    placeBuilding(world, 'wall', left + i, top, { instant: true, freeOfCost: true });
  }
}

// Pre-build a full medieval city around the keep — the player inherits a
// living, defended town instead of an empty field. Layout: square wall ring
// at radius 6 with corner towers and 4 gatehouses at the road crossings,
// houses + civic buildings inside, farms in the eastern strip, slum houses
// to the north and south.
const CITY_RADIUS = 6;

export function placeStartingCity(world: World): void {
  const cx = Math.floor(CONFIG.mapWidth / 2);
  const cy = Math.floor(CONFIG.mapHeight / 2);
  const R = CITY_RADIUS;

  placePerimeter(world, cx, cy, R);
  placeInnerBuildings(world, cx, cy);
  placeFarmsAndSlums(world, cx, cy);
}

function placePerimeter(world: World, cx: number, cy: number, R: number): void {
  // Top and bottom edges
  for (let x = cx - R; x <= cx + R; x++) {
    const isCorner = x === cx - R || x === cx + R;
    const isNorthGate = x === cx || x === cx - 1;
    if (isCorner) continue;                // towers placed last
    if (isNorthGate) {
      placeBuilding(world, 'gatehouse', x, cy - R, { instant: true, freeOfCost: true });
      placeBuilding(world, 'gatehouse', x, cy + R, { instant: true, freeOfCost: true });
    } else {
      placeBuilding(world, 'wall', x, cy - R, { instant: true, freeOfCost: true });
      placeBuilding(world, 'wall', x, cy + R, { instant: true, freeOfCost: true });
    }
  }
  // Left and right edges
  for (let y = cy - R + 1; y < cy + R; y++) {
    if (y === cy) {
      placeBuilding(world, 'gatehouse', cx - R, y, { instant: true, freeOfCost: true });
      placeBuilding(world, 'gatehouse', cx + R, y, { instant: true, freeOfCost: true });
    } else {
      placeBuilding(world, 'wall', cx - R, y, { instant: true, freeOfCost: true });
      placeBuilding(world, 'wall', cx + R, y, { instant: true, freeOfCost: true });
    }
  }
  // Corner towers
  placeBuilding(world, 'tower', cx - R, cy - R, { instant: true, freeOfCost: true });
  placeBuilding(world, 'tower', cx + R, cy - R, { instant: true, freeOfCost: true });
  placeBuilding(world, 'tower', cx - R, cy + R, { instant: true, freeOfCost: true });
  placeBuilding(world, 'tower', cx + R, cy + R, { instant: true, freeOfCost: true });
}

function placeInnerBuildings(world: World, cx: number, cy: number): void {
  // Houses scattered through the 4 quadrants, avoiding the road tiles
  // (col cx-1 and cx are the north-south road; row cy is the east-west).
  const inner: Array<[number, number, 'house' | 'tavern' | 'chapel' | 'market' | 'barracks']> = [
    // NW quadrant
    [cx - 5, cy - 5, 'house'], [cx - 3, cy - 5, 'house'],
    [cx - 5, cy - 3, 'house'], [cx - 3, cy - 3, 'house'],
    [cx - 4, cy - 2, 'tavern'],
    [cx - 5, cy - 1, 'house'], [cx - 3, cy - 1, 'house'],
    // NE quadrant
    [cx + 2, cy - 5, 'house'], [cx + 4, cy - 5, 'house'],
    [cx + 2, cy - 3, 'house'], [cx + 4, cy - 3, 'house'],
    [cx + 3, cy - 2, 'chapel'],
    [cx + 2, cy - 1, 'house'], [cx + 4, cy - 1, 'house'],
    // SW quadrant
    [cx - 5, cy + 1, 'house'], [cx - 3, cy + 1, 'house'],
    [cx - 4, cy + 2, 'barracks'],
    [cx - 5, cy + 3, 'house'], [cx - 3, cy + 3, 'house'],
    [cx - 5, cy + 5, 'house'], [cx - 3, cy + 5, 'house'],
    // SE quadrant
    [cx + 2, cy + 1, 'house'], [cx + 4, cy + 1, 'house'],
    [cx + 3, cy + 2, 'market'],
    [cx + 2, cy + 3, 'house'], [cx + 4, cy + 3, 'house'],
    [cx + 2, cy + 5, 'house'], [cx + 4, cy + 5, 'house'],
  ];
  for (const [x, y, kind] of inner) {
    placeBuilding(world, kind, x, y, { instant: true, freeOfCost: true });
  }
}

function placeFarmsAndSlums(world: World, cx: number, cy: number): void {
  // Eastern orchards / farmland — 8 farms in a tidy block.
  for (let dy = -4; dy <= 4; dy += 2) {
    for (let dx = 14; dx <= 18; dx += 2) {
      placeBuilding(world, 'farm', cx + dx, cy + dy, { instant: true, freeOfCost: true });
    }
  }
  // Northern Slums — sparse houses outside the wall, between river and city.
  const north: Array<[number, number]> = [
    [cx - 4, cy - 18], [cx - 2, cy - 19], [cx, cy - 20],
    [cx + 2, cy - 19], [cx + 4, cy - 18], [cx - 3, cy - 15],
    [cx + 3, cy - 15], [cx, cy - 14],
  ];
  for (const [x, y] of north) {
    placeBuilding(world, 'house', x, y, { instant: true, freeOfCost: true });
  }
  // Southern Slums — a smaller cluster.
  const south: Array<[number, number]> = [
    [cx - 3, cy + 16], [cx, cy + 17], [cx + 3, cy + 16],
    [cx - 4, cy + 19], [cx + 4, cy + 19],
  ];
  for (const [x, y] of south) {
    placeBuilding(world, 'house', x, y, { instant: true, freeOfCost: true });
  }
}
