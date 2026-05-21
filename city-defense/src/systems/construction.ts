import type { World } from '../world/world.ts';
import { allocate } from '../ecs/store.ts';
import { setComponent, getComponent, each } from '../ecs/store.ts';
import type { BuildingKind, Building } from '../ecs/components.ts';
import { buildingDef } from '../data/buildings.ts';
import { getTerrain, getBuildingAt, setBuildingAt, inBounds } from '../world/tilemap.ts';

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
