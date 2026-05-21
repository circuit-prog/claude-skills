import type { World } from '../world/world.ts';
import { each } from '../ecs/store.ts';
import { buildingDef } from '../data/buildings.ts';
import { CONFIG } from '../data/config.ts';

export function housingCapacity(world: World): number {
  let cap = CONFIG.startingHousingFromKeep;
  each(world.components.building, (_, b) => {
    if (b.state !== 'operational') return;
    const def = buildingDef(b.kind);
    if (def.housing) cap += def.housing;
  });
  return cap;
}

// Daily housing pass: anyone over the capacity is homeless.
export function updateHomelessDay(world: World): void {
  const cap = housingCapacity(world);
  world.population.homeless = Math.max(0, world.population.total - cap);
}
