import type { World } from '../world/world.ts';
import type { EnemyKind, Enemy } from '../ecs/components.ts';
import type { EntityId } from '../ecs/store.ts';
import { allocate, setComponent } from '../ecs/store.ts';
import { ENEMIES, WAVES } from '../data/enemies.ts';
import type { Wave } from '../data/enemies.ts';
import { CONFIG } from '../data/config.ts';
import { nextInt } from '../engine/rng.ts';
import { findPath } from '../world/pathfinding.ts';
import { getBuildingAt, inBounds } from '../world/tilemap.ts';
import { effectiveBuff } from '../world/world.ts';

// Daily check: spawn any wave whose day matches the current world day.
export function spawnWavesDay(world: World): void {
  if (world.phase !== 'siege') return;
  for (const w of WAVES) {
    if (w.day !== world.day) continue;
    spawnWave(world, w);
  }
}

function spawnWave(world: World, wave: Wave): void {
  const keepId = findKeepId(world);
  const edge = wave.edge ?? randomEdge(world);
  for (const [kindStr, count] of Object.entries(wave.composition)) {
    if (!count || count <= 0) continue;
    const kind = kindStr as EnemyKind;
    const def = ENEMIES[kind];
    for (let i = 0; i < count; i++) {
      const [sx, sy] = pickSpawnTile(world, edge, i);
      const id = allocate(world.entities);
      setComponent(world.components.position, id, { x: sx, y: sy });
      setComponent(world.components.health, id, { hp: def.hp, max: def.hp });
      const enemy: Enemy = {
        kind, faction: wave.faction,
        attackCooldown: 0, moveCooldown: nextInt(world.rng, def.ticksPerStep),
        path: [],
      };
      if (keepId !== null) enemy.target = keepId;
      setComponent(world.components.enemy, id, enemy);
    }
  }
}

function randomEdge(world: World): 'north' | 'south' | 'east' | 'west' {
  const r = nextInt(world.rng, 4);
  return (['north', 'south', 'east', 'west'] as const)[r]!;
}

function pickSpawnTile(world: World, edge: 'north' | 'south' | 'east' | 'west', offset: number): [number, number] {
  const w = world.tilemap.width, h = world.tilemap.height;
  switch (edge) {
    case 'north': return [Math.min(w - 1, Math.floor(w / 2) - 6 + offset), 0];
    case 'south': return [Math.min(w - 1, Math.floor(w / 2) - 6 + offset), h - 1];
    case 'east':  return [w - 1, Math.min(h - 1, Math.floor(h / 2) - 6 + offset)];
    case 'west':  return [0,     Math.min(h - 1, Math.floor(h / 2) - 6 + offset)];
  }
}

function findKeepId(world: World): EntityId | null {
  for (const [id, b] of world.components.building.map) {
    if (b.kind === 'keep') return id;
  }
  return null;
}

// Per-tick AI: each enemy moves toward its target, attacks adjacent walls /
// the keep, and replans when its path is broken.
export function advanceEnemiesTick(world: World): void {
  const keepId = findKeepId(world);
  if (keepId === null) return;
  const keepPos = world.components.position.map.get(keepId);
  if (!keepPos) return;

  for (const [id, enemy] of [...world.components.enemy.map]) {
    const pos = world.components.position.map.get(id);
    const hp = world.components.health.map.get(id);
    if (!pos || !hp) continue;
    if (hp.hp <= 0) { removeEnemy(world, id); continue; }

    const def = ENEMIES[enemy.kind];

    // If we're adjacent to the keep, smash it.
    if (taxicab(pos.x, pos.y, keepPos.x, keepPos.y) <= 1) {
      tryAttackBuilding(world, enemy, keepId);
      continue;
    }

    // If we're adjacent to a wall blocking our planned path, break it.
    const adjacentWall = findAdjacentBuilding(world, pos.x, pos.y, ['wall', 'gatehouse', 'tower']);
    if (adjacentWall !== null && pathRequiresBreak(world, pos, keepPos)) {
      tryAttackBuilding(world, enemy, adjacentWall);
      continue;
    }

    // Move toward target.
    enemy.moveCooldown -= 1;
    if (enemy.moveCooldown > 0) continue;
    enemy.moveCooldown = def.ticksPerStep;

    if (enemy.path.length === 0
        || enemy.pathTargetX !== keepPos.x
        || enemy.pathTargetY !== keepPos.y) {
      enemy.path = findPath(world.tilemap, pos.x, pos.y, keepPos.x, keepPos.y,
        (x, y) => isBlockedForEnemy(world, x, y, keepPos.x, keepPos.y));
      enemy.pathTargetX = keepPos.x;
      enemy.pathTargetY = keepPos.y;
    }

    if (enemy.path.length === 0) {
      // No route — attack the closest wall to begin a breach.
      const wallId = findClosestBuilding(world, pos.x, pos.y, ['wall', 'gatehouse', 'tower']);
      if (wallId !== null) {
        // Move one tile toward it.
        const wpos = world.components.position.map.get(wallId);
        if (wpos) stepTowards(world, pos, wpos.x, wpos.y);
      }
      continue;
    }

    const next = enemy.path[0]!;
    // If the next tile became blocked since last plan, drop the path and try again.
    if (isBlockedForEnemy(world, next.x, next.y, keepPos.x, keepPos.y)) {
      enemy.path = [];
      continue;
    }
    pos.x = next.x; pos.y = next.y;
    enemy.path.shift();
  }
}

function isBlockedForEnemy(world: World, x: number, y: number, endX: number, endY: number): boolean {
  if (!inBounds(world.tilemap, x, y)) return true;
  if (x === endX && y === endY) return false;     // keep tile is the destination
  const bId = getBuildingAt(world.tilemap, x, y);
  if (bId === null) return false;
  const b = world.components.building.map.get(bId);
  if (!b) return false;
  // Walls, towers, gatehouses block enemies; other player buildings can be
  // walked through and trampled — that's the design tension (no wall ring
  // means raiders walk straight to the keep).
  return b.kind === 'wall' || b.kind === 'tower' || b.kind === 'gatehouse';
}

function pathRequiresBreak(world: World, pos: { x: number; y: number }, keepX: { x: number; y: number }): boolean {
  // Quick: if A* yields nothing, we need to break.
  const path = findPath(world.tilemap, pos.x, pos.y, keepX.x, keepX.y,
    (x, y) => isBlockedForEnemy(world, x, y, keepX.x, keepX.y));
  return path.length === 0;
}

function findAdjacentBuilding(world: World, x: number, y: number, kinds: readonly string[]): EntityId | null {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const id = getBuildingAt(world.tilemap, x + dx, y + dy);
    if (id === null) continue;
    const b = world.components.building.map.get(id);
    if (b && kinds.includes(b.kind)) return id;
  }
  return null;
}

function findClosestBuilding(world: World, x: number, y: number, kinds: readonly string[]): EntityId | null {
  let best: EntityId | null = null;
  let bestDist = Infinity;
  for (const [id, b] of world.components.building.map) {
    if (!kinds.includes(b.kind)) continue;
    const p = world.components.position.map.get(id);
    if (!p) continue;
    const d = taxicab(x, y, p.x, p.y);
    if (d < bestDist) { bestDist = d; best = id; }
  }
  return best;
}

function stepTowards(world: World, pos: { x: number; y: number }, tx: number, ty: number): void {
  const dx = Math.sign(tx - pos.x);
  const dy = Math.sign(ty - pos.y);
  // Prefer the larger axis.
  if (Math.abs(tx - pos.x) >= Math.abs(ty - pos.y)) {
    if (dx !== 0 && !blocked(world, pos.x + dx, pos.y)) { pos.x += dx; return; }
    if (dy !== 0 && !blocked(world, pos.x, pos.y + dy)) { pos.y += dy; return; }
  } else {
    if (dy !== 0 && !blocked(world, pos.x, pos.y + dy)) { pos.y += dy; return; }
    if (dx !== 0 && !blocked(world, pos.x + dx, pos.y)) { pos.x += dx; return; }
  }
}

function blocked(world: World, x: number, y: number): boolean {
  if (!inBounds(world.tilemap, x, y)) return true;
  const bid = getBuildingAt(world.tilemap, x, y);
  if (bid === null) return false;
  const b = world.components.building.map.get(bid);
  return b ? (b.kind === 'wall' || b.kind === 'tower' || b.kind === 'gatehouse') : false;
}

function tryAttackBuilding(world: World, enemy: Enemy, buildingId: EntityId): void {
  enemy.attackCooldown -= 1;
  if (enemy.attackCooldown > 0) return;
  enemy.attackCooldown = CONFIG.attackCooldownTicks;
  const def = ENEMIES[enemy.kind];
  const hp = world.components.health.map.get(buildingId);
  const b = world.components.building.map.get(buildingId);
  if (!hp || !b) return;
  // wallHpPct buffs the *target*; enemies see a tougher wall.
  const wallBuff = 1 + effectiveBuff(world, 'wallHpPct') / 100;
  const damage = Math.max(1, def.wallDamage - Math.floor((hp.max * (wallBuff - 1)) / 50));
  hp.hp -= damage;
  if (hp.hp <= 0) {
    hp.hp = 0;
    b.state = 'ruined';
    // Free the tile so the path planner can route through.
    const pos = world.components.position.map.get(buildingId);
    if (pos) world.tilemap.buildingAt[pos.y * world.tilemap.width + pos.x] = null;
  } else if (hp.hp < hp.max * 0.5) {
    b.state = 'damaged';
  }
}

function removeEnemy(world: World, id: EntityId): void {
  world.components.enemy.map.delete(id);
  world.components.position.map.delete(id);
  world.components.health.map.delete(id);
}

function taxicab(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export function totalEnemies(world: World): number {
  return world.components.enemy.map.size;
}
