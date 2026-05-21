export type EntityId = number;

export interface ComponentStore<T> {
  map: Map<EntityId, T>;
}

export function createStore<T>(): ComponentStore<T> {
  return { map: new Map() };
}

export function setComponent<T>(store: ComponentStore<T>, id: EntityId, c: T): void {
  store.map.set(id, c);
}

export function getComponent<T>(store: ComponentStore<T>, id: EntityId): T | undefined {
  return store.map.get(id);
}

export function removeComponent<T>(store: ComponentStore<T>, id: EntityId): void {
  store.map.delete(id);
}

export function each<T>(store: ComponentStore<T>, fn: (id: EntityId, c: T) => void): void {
  for (const [id, c] of store.map) fn(id, c);
}

export interface EntityAllocator {
  next: EntityId;
}

export function createAllocator(): EntityAllocator {
  return { next: 1 };
}

export function allocate(alloc: EntityAllocator): EntityId {
  return alloc.next++;
}
