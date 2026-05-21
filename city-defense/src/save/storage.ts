import type { World } from '../world/world.ts';
import { toJSON, fromJSON } from './serialize.ts';

const PREFIX = 'citydef.save.';
export const SLOT_AUTOSAVE = 'autosave';
export const SLOT_QUICK = 'quick';

export function saveTo(slot: string, world: World): void {
  const env = toJSON(world);
  localStorage.setItem(PREFIX + slot, JSON.stringify(env));
}

export function loadInto(slot: string, world: World): boolean {
  const raw = localStorage.getItem(PREFIX + slot);
  if (!raw) return false;
  try {
    fromJSON(JSON.parse(raw), world);
    return true;
  } catch (err) {
    console.error(`load ${slot} failed:`, err);
    return false;
  }
}

export function hasSave(slot: string): boolean {
  return localStorage.getItem(PREFIX + slot) !== null;
}

export function deleteSlot(slot: string): void {
  localStorage.removeItem(PREFIX + slot);
}

export interface AutosaveTriggers {
  dispose(): void;
}

// Autosave on day rollover is driven by the simulation loop (caller invokes
// `saveTo(SLOT_AUTOSAVE, world)` itself). This module wires the *browser*
// triggers: tab hide and beforeunload.
export function bindAutosaveTriggers(world: World): AutosaveTriggers {
  const writeAutosave = () => saveTo(SLOT_AUTOSAVE, world);
  const onVisibility = () => { if (document.hidden) writeAutosave(); };
  const onBeforeUnload = () => writeAutosave();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('beforeunload', onBeforeUnload);
  return {
    dispose() {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
    },
  };
}
