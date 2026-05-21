import type { Tilemap } from './tilemap.ts';
import { tileIndex, inBounds } from './tilemap.ts';

export interface PathPoint { x: number; y: number; }

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

interface NodeInfo {
  gScore: number;
  fScore: number;
  cameFromIdx: number;
  open: boolean;
}

// 4-direction A* over the tilemap. Tiles where `isBlocked(x, y)` returns true
// are impassable. Returns the path from start (exclusive) to end (inclusive),
// or [] if no path exists.
export function findPath(
  map: Tilemap,
  startX: number, startY: number,
  endX: number, endY: number,
  isBlocked: (x: number, y: number) => boolean,
): PathPoint[] {
  if (!inBounds(map, startX, startY) || !inBounds(map, endX, endY)) return [];
  if (startX === endX && startY === endY) return [];

  const N = map.width * map.height;
  const nodes: Record<number, NodeInfo> = {};
  const startIdx = tileIndex(map, startX, startY);
  const endIdx = tileIndex(map, endX, endY);

  // Binary-heap-lite: a sorted array of [fScore, idx]. Fine at our map scale.
  const open: Array<[number, number]> = [];
  function push(f: number, idx: number) {
    let lo = 0, hi = open.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (open[mid]![0] < f) lo = mid + 1; else hi = mid;
    }
    open.splice(lo, 0, [f, idx]);
  }
  function pop(): number | null {
    if (open.length === 0) return null;
    return open.shift()![1];
  }

  nodes[startIdx] = { gScore: 0, fScore: heuristic(startX, startY, endX, endY), cameFromIdx: -1, open: true };
  push(nodes[startIdx]!.fScore, startIdx);

  while (true) {
    const cur = pop();
    if (cur === null) break;
    const ci = nodes[cur];
    if (!ci || !ci.open) continue;
    ci.open = false;

    if (cur === endIdx) return reconstruct(map, nodes, endIdx);

    const cx = cur % map.width;
    const cy = Math.floor(cur / map.width);
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!inBounds(map, nx, ny)) continue;
      // The end tile may itself be the keep — allow finishing there even if
      // it would otherwise be 'blocked' (buildings count as blocked).
      if (!(nx === endX && ny === endY) && isBlocked(nx, ny)) continue;
      const nIdx = tileIndex(map, nx, ny);
      const tentative = ci.gScore + 1;
      const existing = nodes[nIdx];
      if (existing && tentative >= existing.gScore) continue;
      const f = tentative + heuristic(nx, ny, endX, endY);
      nodes[nIdx] = { gScore: tentative, fScore: f, cameFromIdx: cur, open: true };
      push(f, nIdx);
    }
  }

  // No path. Caller is responsible for fallback (e.g., attack nearest wall).
  void N;
  return [];
}

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function reconstruct(map: Tilemap, nodes: Record<number, NodeInfo>, endIdx: number): PathPoint[] {
  const path: PathPoint[] = [];
  let cur = endIdx;
  while (cur !== -1) {
    const x = cur % map.width;
    const y = Math.floor(cur / map.width);
    path.push({ x, y });
    const parent = nodes[cur]?.cameFromIdx ?? -1;
    if (parent === -1) break;
    cur = parent;
  }
  path.reverse();
  path.shift(); // drop the start tile
  return path;
}
