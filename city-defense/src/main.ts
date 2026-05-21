import './styles.css';
import { createWorld } from './world/world.ts';
import type { SetupChoices, SpeedSetting, World } from './world/world.ts';
import { createLoop } from './engine/loop.ts';
import type { SimulateFn, RenderFn, LoopHandles } from './engine/loop.ts';
import { createInputState, bindInput } from './engine/input.ts';
import { createCamera, panScreen, zoomAt, screenToTile } from './render/camera.ts';
import { attachCanvas, render as drawWorld } from './render/renderer.ts';
import type { RenderContext } from './render/renderer.ts';
import { mountHud } from './ui/hud.ts';
import type { Hud } from './ui/hud.ts';
import { mountGameOver } from './ui/gameOver.ts';
import { mountSetupScreen } from './setup/setupScreen.ts';
import { placeBuilding, placeStartingWalls, placeStartingCity } from './systems/construction.ts';
import { spawnStartingArmy, conscriptPeasants, hireMercenaries } from './systems/recruitment.ts';
import { acceptRequest, declineRequest } from './systems/requests.ts';
import { reassignDuties } from './systems/duties.ts';
import { forceStartSiege } from './systems/siege.ts';
import { maybeFireMilestoneDay } from './systems/milestones.ts';
import { choose as chooseEvent } from './systems/events.ts';
import { generateNotables } from './ecs/notables.ts';
import { simulate as runTick } from './systems/simulate.ts';
import { buildingDef } from './data/buildings.ts';
import { GENERALS } from './data/generals.ts';
import type { BuildingKind } from './ecs/components.ts';
import { CONFIG } from './data/config.ts';
import {
  bindAutosaveTriggers, hasSave, loadInto, saveTo, deleteSlot,
  SLOT_AUTOSAVE, SLOT_QUICK,
} from './save/storage.ts';
import { getTerrain } from './world/tilemap.ts';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const hudRoot = document.getElementById('hud') as HTMLDivElement;
if (!canvas || !hudRoot) throw new Error('expected #game-canvas and #hud in DOM');

const cam = createCamera(canvas.clientWidth, canvas.clientHeight);
const rc: RenderContext = attachCanvas(canvas, cam);
const input = createInputState();
const setupScreen = mountSetupScreen(hudRoot);

// Mutable game state. Restart/load swap the object out; closures below
// read `world` fresh each call so they pick up the new world.
let world: World = createPlaceholderWorld();
let hud: Hud | null = null;
let selectedBuilding: BuildingKind | null = null;
let lastAutosaveDay = world.day;
let lastSeenDesertions = world.population.mercenaryDesertions;
let loop: LoopHandles | null = null;

function createPlaceholderWorld(): World {
  // A throwaway world so render() has something to draw while the setup
  // screen is visible. Replaced by startNewGame()/loadExistingGame().
  return createWorld({
    seed: 0,
    general: GENERALS[0]!,
    army: {},
  });
}

function applySetup(choices: SetupChoices): World {
  const w = createWorld(choices);
  // Center the keep at the map middle (loss condition 1 target).
  const keepX = Math.floor(CONFIG.mapWidth / 2);
  const keepY = Math.floor(CONFIG.mapHeight / 2);
  placeBuilding(w, 'keep', keepX, keepY, { instant: true, freeOfCost: true });
  // The city already exists — player inherits walls, gatehouses, houses,
  // civic buildings, farms, and slum sprawl. They still need to bolster
  // defences and manage food/morale, but they don't start from scratch.
  placeStartingCity(w);
  placeStartingWalls(w, choices.general.buff.startingWallSegments ?? 0);
  spawnStartingArmy(w, choices.army);
  generateNotables(w, choices.general.buff.startingNotables ?? 0);
  // Fire any Day-1 milestones now so the opening banner shows on the first
  // frame. The simulate loop only catches milestones via day rollover, so
  // the starting day needs an explicit pass.
  maybeFireMilestoneDay(w);
  return w;
}

function refreshHud() { hud?.update(world, selectedBuilding); }

function handleTileClick(x: number, y: number): void {
  if (!selectedBuilding) return;
  const result = placeBuilding(world, selectedBuilding, x, y);
  if (!result.ok) flashStatus(`Can't build: ${result.reason.replace('-', ' ')}.`);
  refreshHud();
}

function updateHoverTile() {
  if (!selectedBuilding) { rc.hoverTile = undefined; return; }
  const rect = canvas.getBoundingClientRect();
  const tile = screenToTile(cam, input.pointer.x - rect.left, input.pointer.y - rect.top);
  const def = buildingDef(selectedBuilding);
  const t = getTerrain(world.tilemap, tile.x, tile.y);
  const valid = t !== null && def.validOn.includes(t);
  rc.hoverTile = { x: tile.x, y: tile.y, valid };
}

const simulate: SimulateFn = (w) => { runTick(w); };

const renderFn: RenderFn = (w) => {
  updateHoverTile();
  drawWorld(rc, w);

  if (w.day !== lastAutosaveDay) {
    lastAutosaveDay = w.day;
    saveTo(SLOT_AUTOSAVE, w);
  }
  if (w.population.mercenaryDesertions !== lastSeenDesertions) {
    const delta = w.population.mercenaryDesertions - lastSeenDesertions;
    if (delta > 0) {
      flashStatus(`${delta} mercenar${delta === 1 ? 'y' : 'ies'} deserted!`);
    }
    lastSeenDesertions = w.population.mercenaryDesertions;
  }
  if (w.gameOver) {
    w.speed = 0;
    gameOver.show(w);
  }
  refreshHud();
};

// Status banner
const status = document.createElement('div');
status.style.cssText = `
  position:absolute; bottom:4rem; left:50%; transform:translateX(-50%);
  background:rgba(0,0,0,0.85); color:#f0e4c8; padding:0.3rem 0.8rem;
  border:1px solid #5a4530; font-size:0.85rem; opacity:0;
  transition:opacity 0.3s; pointer-events:none; z-index: 15;
`;
hudRoot.append(status);
let statusTimer = 0;
function flashStatus(msg: string) {
  status.textContent = msg;
  status.style.opacity = '1';
  clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => { status.style.opacity = '0'; }, 1500);
}

const gameOver = mountGameOver(hudRoot, () => {
  gameOver.hide();
  void startFreshGame();
});

hud = mountHud(hudRoot, {
  setSpeed: (s: SpeedSetting) => { world.speed = s; refreshHud(); },
  selectBuilding: (k) => { selectedBuilding = k; refreshHud(); },
  setTaxRate: (r) => { world.policy.taxRate = Math.max(0, Math.min(30, r)); refreshHud(); },
  setRationing: (r) => { world.policy.rationing = r; refreshHud(); },
  acceptRequest: (id) => {
    const result = acceptRequest(world, id);
    if (!result.ok) flashStatus(`Can't accept: ${result.reason}.`);
    refreshHud();
  },
  declineRequest: (id) => { declineRequest(world, id); refreshHud(); },
  reassignDuty: (from, to, count) => {
    const moved = reassignDuties(world, from, to, count);
    if (moved === 0) flashStatus(`No ${from} soldiers to reassign.`);
    refreshHud();
  },
  conscriptPeasants: (count) => {
    const result = conscriptPeasants(world, count);
    if (!result.ok) flashStatus(`Can't conscript: ${result.reason}.`);
    else flashStatus(`+${result.count} levy${result.count === 1 ? '' : 'men'}.`);
    refreshHud();
  },
  hireMercenaries: (count) => {
    const result = hireMercenaries(world, count);
    if (!result.ok) flashStatus(`Can't hire: ${result.reason}.`);
    else flashStatus(`+${result.count} mercenar${result.count === 1 ? 'y' : 'ies'}.`);
    refreshHud();
  },
  forceStartSiege: () => {
    forceStartSiege(world);
    flashStatus('The siege begins.');
    refreshHud();
  },
  chooseEvent: (idx) => {
    const result = chooseEvent(world, idx);
    if (!result.ok) flashStatus(`Cannot pick: ${result.reason}.`);
    // Restore speed after the modal closes.
    if (!world.pendingMilestoneId && !world.pendingEventId && world.speed === 0 && !world.gameOver) {
      world.speed = 1;
    }
    refreshHud();
  },
  saveGame: () => { saveTo(SLOT_QUICK, world); flashStatus('Saved.'); },
  loadGame: () => {
    if (loadInto(SLOT_QUICK, world)) {
      gameOver.hide();
      flashStatus('Loaded.');
      refreshHud();
      return true;
    }
    flashStatus('No save in quick slot.');
    return false;
  },
});

bindInput(input, {
  canvas,
  getSpeed: () => world.speed,
  onPan: (dx, dy) => { panScreen(cam, dx, dy); },
  onZoom: (delta, ax, ay) => {
    const rect = canvas.getBoundingClientRect();
    zoomAt(cam, delta, ax - rect.left, ay - rect.top);
  },
  onClick: (sx, sy) => {
    const rect = canvas.getBoundingClientRect();
    const tile = screenToTile(cam, sx - rect.left, sy - rect.top);
    handleTileClick(tile.x, tile.y);
  },
  onSpeed: (s) => { world.speed = s; refreshHud(); },
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { selectedBuilding = null; refreshHud(); }
});

bindAutosaveTriggers(world);

async function startFreshGame(): Promise<void> {
  // Pause sim, show setup, swap world on commit.
  if (loop) loop.stop();
  world.speed = 0;
  const choices = await setupScreen.show();
  world = applySetup(choices);
  lastAutosaveDay = world.day;
  lastSeenDesertions = world.population.mercenaryDesertions;
  deleteSlot(SLOT_AUTOSAVE);
  saveTo(SLOT_AUTOSAVE, world);
  refreshHud();
  loop = createLoop(world, simulate, renderFn);
  loop.start();
}

function loadExistingGame(): boolean {
  if (!hasSave(SLOT_AUTOSAVE)) return false;
  const ok = loadInto(SLOT_AUTOSAVE, world);
  if (!ok) return false;
  lastAutosaveDay = world.day;
  lastSeenDesertions = world.population.mercenaryDesertions;
  refreshHud();
  loop = createLoop(world, simulate, renderFn);
  loop.start();
  return true;
}

// Boot: offer resume if an autosave exists, otherwise straight to setup.
async function boot() {
  if (hasSave(SLOT_AUTOSAVE)) {
    if (confirm('Continue previous game?')) {
      if (loadExistingGame()) return;
    }
  }
  await startFreshGame();
}
void boot();
