import type { World } from '../world/world.ts';
import type { Soldier } from '../ecs/components.ts';
import type { EntityId } from '../ecs/store.ts';
import { UNITS } from '../data/units.ts';
import { ENEMIES } from '../data/enemies.ts';
import { CONFIG } from '../data/config.ts';
import { garrisonStrengthMultiplier } from './notables.ts';
import { getBuildingAt, inBounds } from '../world/tilemap.ts';

// Per-tick: each soldier acts based on duty. Cooldown-gated; cheap to run.
export function advanceSoldiersTick(world: World): void {
  for (const [id, soldier] of world.components.soldier.map) {
    const pos = world.components.position.map.get(id);
    const duty = world.components.duty.map.get(id);
    const hp = world.components.health.map.get(id);
    if (!pos || !duty || !hp) continue;
    if (hp.hp <= 0) { removeSoldier(world, id); continue; }

    if (duty.kind === 'watch' || duty.kind === 'reserve') {
      // Watch and reserve only fight if an enemy is in melee range.
      maybeAttackAdjacent(world, id, soldier);
      continue;
    }

    if (duty.kind === 'wall' || duty.kind === 'gatehouse') {
      runWallDuty(world, id, soldier, pos, duty);
      continue;
    }

    if (duty.kind === 'sally') {
      runSallyDuty(world, id, soldier, pos);
      continue;
    }
  }
}

function runWallDuty(
  world: World,
  id: EntityId,
  soldier: Soldier,
  pos: { x: number; y: number },
  duty: { postX?: number; postY?: number },
): void {
  // If no post, anchor on the nearest standing wall tile.
  if (duty.postX === undefined || duty.postY === undefined) {
    const wallId = findClosestBuilding(world, pos.x, pos.y, ['wall', 'tower', 'gatehouse']);
    if (wallId !== null) {
      const wpos = world.components.position.map.get(wallId);
      if (wpos) { duty.postX = wpos.x; duty.postY = wpos.y; }
    }
  }
  // Move toward post if more than 1 tile away.
  if (duty.postX !== undefined && duty.postY !== undefined) {
    const dist = taxicab(pos.x, pos.y, duty.postX, duty.postY);
    if (dist > 1) stepToward(world, soldier, pos, duty.postX, duty.postY);
  }
  maybeAttackAdjacent(world, id, soldier);
}

function runSallyDuty(
  world: World,
  id: EntityId,
  soldier: Soldier,
  pos: { x: number; y: number },
): void {
  const target = findClosestEnemy(world, pos.x, pos.y, CONFIG.soldierEngageRange * 4);
  if (target === null) return;     // hold position when nothing to chase
  const tpos = world.components.position.map.get(target);
  if (!tpos) return;
  const dist = taxicab(pos.x, pos.y, tpos.x, tpos.y);
  if (dist > 1) {
    stepToward(world, soldier, pos, tpos.x, tpos.y);
  }
  maybeAttackAdjacent(world, id, soldier);
}

function maybeAttackAdjacent(world: World, id: EntityId, soldier: Soldier): void {
  soldier.attackCooldown -= 1;
  if (soldier.attackCooldown > 0) return;
  const pos = world.components.position.map.get(id);
  if (!pos) return;
  const def = UNITS[soldier.unit];
  const range = def.ranged ? CONFIG.rangedRange : CONFIG.combatRange;
  const target = findClosestEnemy(world, pos.x, pos.y, range);
  if (target === null) return;
  const tpos = world.components.position.map.get(target);
  if (!tpos) return;
  const dist = taxicab(pos.x, pos.y, tpos.x, tpos.y);
  if (dist > range) return;
  soldier.attackCooldown = CONFIG.attackCooldownTicks;

  const attackBuff = 1 + (world.general.buff.attackPct ?? 0) / 100;
  const captainMult = garrisonStrengthMultiplier(world);
  const ehp = world.components.health.map.get(target);
  const e = world.components.enemy.map.get(target);
  if (!ehp || !e) return;
  const enemyDef = ENEMIES[e.kind];
  const dmg = Math.max(1, Math.round((def.attack * attackBuff * captainMult) - enemyDef.defence * 0.5));
  ehp.hp -= dmg;
  if (ehp.hp <= 0) {
    ehp.hp = 0;
    world.components.enemy.map.delete(target);
    world.components.position.map.delete(target);
    world.components.health.map.delete(target);
  }
}

function findClosestEnemy(world: World, x: number, y: number, maxRange: number): EntityId | null {
  let best: EntityId | null = null;
  let bestDist = Infinity;
  for (const [id, _e] of world.components.enemy.map) {
    void _e;
    const p = world.components.position.map.get(id);
    if (!p) continue;
    const d = taxicab(x, y, p.x, p.y);
    if (d <= maxRange && d < bestDist) { bestDist = d; best = id; }
  }
  return best;
}

function findClosestBuilding(world: World, x: number, y: number, kinds: readonly string[]): EntityId | null {
  let best: EntityId | null = null;
  let bestDist = Infinity;
  for (const [id, b] of world.components.building.map) {
    if (!kinds.includes(b.kind)) continue;
    if (b.state === 'ruined') continue;
    const p = world.components.position.map.get(id);
    if (!p) continue;
    const d = taxicab(x, y, p.x, p.y);
    if (d < bestDist) { bestDist = d; best = id; }
  }
  return best;
}

function stepToward(
  world: World,
  soldier: Soldier,
  pos: { x: number; y: number },
  tx: number, ty: number,
): void {
  soldier.moveCooldown -= 1;
  if (soldier.moveCooldown > 0) return;
  const def = UNITS[soldier.unit];
  const moveBuff = 1 + (world.general.buff.movePct ?? 0) / 100;
  soldier.moveCooldown = Math.max(2, Math.floor(def.ticksPerStep / moveBuff));

  const dx = Math.sign(tx - pos.x);
  const dy = Math.sign(ty - pos.y);
  if (Math.abs(tx - pos.x) >= Math.abs(ty - pos.y)) {
    if (dx !== 0 && canStand(world, pos.x + dx, pos.y)) { pos.x += dx; return; }
    if (dy !== 0 && canStand(world, pos.x, pos.y + dy)) { pos.y += dy; return; }
  } else {
    if (dy !== 0 && canStand(world, pos.x, pos.y + dy)) { pos.y += dy; return; }
    if (dx !== 0 && canStand(world, pos.x + dx, pos.y)) { pos.x += dx; return; }
  }
}

function canStand(world: World, x: number, y: number): boolean {
  if (!inBounds(world.tilemap, x, y)) return false;
  const bid = getBuildingAt(world.tilemap, x, y);
  if (bid === null) return true;
  const b = world.components.building.map.get(bid);
  if (!b) return true;
  // Soldiers can pass through ruined and friendly non-wall buildings.
  return b.state === 'ruined' || !(b.kind === 'wall' || b.kind === 'tower' || b.kind === 'gatehouse');
}

function removeSoldier(world: World, id: EntityId): void {
  world.components.soldier.map.delete(id);
  world.components.position.map.delete(id);
  world.components.health.map.delete(id);
  world.components.duty.map.delete(id);
}

function taxicab(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}
