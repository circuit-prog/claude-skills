import type { World, ArmyComposition } from '../world/world.ts';
import type { UnitKind } from '../ecs/components.ts';
import { allocate, setComponent } from '../ecs/store.ts';
import { UNITS } from '../data/units.ts';
import { CONFIG } from '../data/config.ts';

// Spawn the starting army chosen on the setup screen. Soldiers begin on
// 'reserve' duty; the duty panel reassigns them during the prep phase.
export function spawnStartingArmy(world: World, comp: ArmyComposition): void {
  const keepX = Math.floor(CONFIG.mapWidth / 2);
  const keepY = Math.floor(CONFIG.mapHeight / 2);
  let placedCount = 0;

  for (const [kindStr, count] of Object.entries(comp)) {
    if (!count || count <= 0) continue;
    const kind = kindStr as UnitKind;
    const def = UNITS[kind];
    for (let i = 0; i < count; i++) {
      const id = allocate(world.entities);
      // Spiral out from the keep so units don't all sit on one tile.
      const ring = 1 + Math.floor(placedCount / 8);
      const ringIdx = placedCount % 8;
      const dx = [1, 1, 0, -1, -1, -1, 0, 1][ringIdx]! * ring;
      const dy = [0, 1, 1, 1, 0, -1, -1, -1][ringIdx]! * ring;
      setComponent(world.components.position, id, { x: keepX + dx, y: keepY + dy });
      setComponent(world.components.soldier, id, {
        unit: kind,
        named: false,
        loyalty: 80,
        attackCooldown: 0,
        moveCooldown: 0,
      });
      setComponent(world.components.health, id, { hp: def.hp, max: def.hp });
      setComponent(world.components.duty, id, { kind: 'reserve' });
      placedCount += 1;
    }
  }
}

export function armyGoldCost(comp: ArmyComposition): number {
  let g = 0;
  for (const [k, n] of Object.entries(comp)) {
    if (!n) continue;
    g += UNITS[k as UnitKind].goldCost * n;
  }
  return g;
}

export function armyDailyFoodCost(comp: ArmyComposition): number {
  let f = 0;
  for (const [k, n] of Object.entries(comp)) {
    if (!n) continue;
    f += UNITS[k as UnitKind].foodPerDay * n;
  }
  return f;
}

export function armyDailyUpkeep(comp: ArmyComposition): number {
  let u = 0;
  for (const [k, n] of Object.entries(comp)) {
    if (!n) continue;
    u += UNITS[k as UnitKind].upkeepGoldPerDay * n;
  }
  return u;
}

export function totalSoldiers(comp: ArmyComposition): number {
  let s = 0;
  for (const [, n] of Object.entries(comp)) if (n) s += n;
  return s;
}
