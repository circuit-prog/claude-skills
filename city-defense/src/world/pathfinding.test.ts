import { describe, it, expect } from 'vitest';
import { createTilemap, setTerrain } from './tilemap.ts';
import { findPath } from './pathfinding.ts';

describe('A* pathfinding', () => {
  it('finds a path on an empty grid', () => {
    const m = createTilemap(10, 10);
    const path = findPath(m, 0, 0, 9, 9, () => false);
    expect(path.length).toBeGreaterThan(0);
    expect(path[path.length - 1]).toEqual({ x: 9, y: 9 });
    expect(path.length).toBe(18); // taxicab distance
  });

  it('routes around a single blocking column', () => {
    const m = createTilemap(10, 10);
    const blocked = (x: number, y: number) => x === 4 && y < 9;
    const path = findPath(m, 0, 5, 9, 5, blocked);
    expect(path.length).toBeGreaterThan(0);
    expect(path[path.length - 1]).toEqual({ x: 9, y: 5 });
    // Cannot pass straight through x=4 — must detour through y=9.
    expect(path.some((p) => p.x === 4 && p.y === 9)).toBe(true);
  });

  it('returns empty when fully walled in', () => {
    const m = createTilemap(10, 10);
    const blocked = (x: number, _y: number) => x === 4;
    const path = findPath(m, 0, 5, 9, 5, blocked);
    expect(path).toEqual([]);
  });

  it('always reaches the end tile even if it is "blocked"', () => {
    // The end (keep) tile counts as blocked under the enemy predicate but
    // A* must still pathfind to it — that's the loss-condition target.
    const m = createTilemap(10, 10);
    const blocked = (x: number, y: number) => x === 9 && y === 9;
    const path = findPath(m, 0, 0, 9, 9, blocked);
    expect(path[path.length - 1]).toEqual({ x: 9, y: 9 });
  });

  it('returns [] for start == end', () => {
    const m = createTilemap(10, 10);
    expect(findPath(m, 3, 3, 3, 3, () => false)).toEqual([]);
  });

  it('respects map bounds', () => {
    const m = createTilemap(5, 5);
    expect(findPath(m, 0, 0, 99, 99, () => false)).toEqual([]);
    void setTerrain; // pacify unused (kept available for future tests)
  });
});
