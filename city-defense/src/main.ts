import './styles.css';
import { createWorld } from './world/world.ts';
import type { SetupChoices, SpeedSetting } from './world/world.ts';
import { createLoop } from './engine/loop.ts';
import type { SimulateFn, RenderFn } from './engine/loop.ts';
import { createInputState, bindInput } from './engine/input.ts';
import { createCamera, panScreen, zoomAt, screenToTile } from './render/camera.ts';
import { attachCanvas, render as drawWorld } from './render/renderer.ts';
import { mountHud } from './ui/hud.ts';
import { mountGameOver } from './ui/gameOver.ts';
import { placeBuilding } from './systems/construction.ts';
import { simulate as runTick } from './systems/simulate.ts';
import { buildingDef } from './data/buildings.ts';
import type { BuildingKind } from './ecs/components.ts';
import { CONFIG } from './data/config.ts';
import {
  bindAutosaveTriggers, hasSave, loadInto, saveTo,
  SLOT_AUTOSAVE, SLOT_QUICK,
} from './save/storage.ts';
import { getTerrain } from './world/tilemap.ts';

const DEFAULT_SETUP: SetupChoices = {
  seed: Math.floor(Math.random() * 0xffffffff),
  general: {
    id: 'veteran-knight',
    name: 'Ser Halric the Veteran',
    buff: { attackPct: 15 },
    drawback: { recruitCostPct: 5 },
  },
};

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const hudRoot = document.getElementById('hud') as HTMLDivElement;
if (!canvas || !hudRoot) throw new Error('expected #game-canvas and #hud in DOM');

let world = createWorld(DEFAULT_SETUP);
const cam = createCamera(canvas.clientWidth, canvas.clientHeight);
const rc = attachCanvas(canvas, cam);
const input = createInputState();

function seedKeep() {
  const keepX = Math.floor(CONFIG.mapWidth / 2);
  const keepY = Math.floor(CONFIG.mapHeight / 2);
  placeBuilding(world, 'keep', keepX, keepY, { instant: true, freeOfCost: true });
}
seedKeep();

let selectedBuilding: BuildingKind | null = null;
let lastAutosaveDay = world.day;

const hud = mountHud(hudRoot, {
  setSpeed: (s: SpeedSetting) => { world.speed = s; refreshHud(); },
  selectBuilding: (k) => { selectedBuilding = k; refreshHud(); },
  setTaxRate: (r) => { world.policy.taxRate = clamp(r, 0, 30); refreshHud(); },
  setRationing: (r) => { world.policy.rationing = r; refreshHud(); },
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

const gameOver = mountGameOver(hudRoot, () => {
  // Restart: fresh world with a fresh seed, fresh autosave.
  world = createWorld({ ...DEFAULT_SETUP, seed: Math.floor(Math.random() * 0xffffffff) });
  seedKeep();
  lastAutosaveDay = world.day;
  saveTo(SLOT_AUTOSAVE, world);
  gameOver.hide();
  refreshHud();
});

function refreshHud() { hud.update(world, selectedBuilding); }

bindInput(input, {
  canvas,
  world,
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
  if (w.gameOver) {
    w.speed = 0;
    gameOver.show(w);
  }
  refreshHud();
};

const status = document.createElement('div');
status.style.cssText = `
  position:absolute; bottom:4rem; left:50%; transform:translateX(-50%);
  background:rgba(0,0,0,0.85); color:#f0e4c8; padding:0.3rem 0.8rem;
  border:1px solid #5a4530; font-size:0.85rem; opacity:0;
  transition:opacity 0.3s; pointer-events:none;
`;
hudRoot.append(status);
let statusTimer = 0;
function flashStatus(msg: string) {
  status.textContent = msg;
  status.style.opacity = '1';
  clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => { status.style.opacity = '0'; }, 1500);
}

bindAutosaveTriggers(world);

if (hasSave(SLOT_AUTOSAVE)) {
  if (confirm('Continue previous game?')) {
    loadInto(SLOT_AUTOSAVE, world);
  }
}

const loop = createLoop(world, simulate, renderFn);
loop.start();
refreshHud();

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
