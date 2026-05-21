import { CONFIG } from '../data/config.ts';

export interface Camera {
  // World pixels at the centre of the viewport (1 world unit = TILE_SIZE px at zoom=1)
  cx: number;
  cy: number;
  zoom: number;
  viewportW: number;
  viewportH: number;
}

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3.0;

export function createCamera(viewportW: number, viewportH: number): Camera {
  const mapPxW = CONFIG.mapWidth * CONFIG.tileSize;
  const mapPxH = CONFIG.mapHeight * CONFIG.tileSize;
  // Fit-to-viewport zoom so the whole city + outskirts are visible on load.
  // Player can wheel-zoom in once they pick a build target.
  const fitZoom = Math.min(viewportW / mapPxW, viewportH / mapPxH) * 0.95;
  return {
    cx: mapPxW / 2,
    cy: mapPxH / 2,
    zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom)),
    viewportW,
    viewportH,
  };
}

export function resizeCamera(cam: Camera, w: number, h: number): void {
  cam.viewportW = w;
  cam.viewportH = h;
}

export function panScreen(cam: Camera, dxScreen: number, dyScreen: number): void {
  cam.cx -= dxScreen / cam.zoom;
  cam.cy -= dyScreen / cam.zoom;
  clampToMap(cam);
}

export function zoomAt(cam: Camera, deltaPx: number, anchorScreenX: number, anchorScreenY: number): void {
  const factor = Math.exp(-deltaPx * 0.0015);
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * factor));
  if (newZoom === cam.zoom) return;

  // Keep the world point under the cursor stationary.
  const worldBefore = screenToWorld(cam, anchorScreenX, anchorScreenY);
  cam.zoom = newZoom;
  const worldAfter = screenToWorld(cam, anchorScreenX, anchorScreenY);
  cam.cx += worldBefore.x - worldAfter.x;
  cam.cy += worldBefore.y - worldAfter.y;
  clampToMap(cam);
}

function clampToMap(cam: Camera): void {
  const mapPxW = CONFIG.mapWidth * CONFIG.tileSize;
  const mapPxH = CONFIG.mapHeight * CONFIG.tileSize;
  cam.cx = Math.max(0, Math.min(mapPxW, cam.cx));
  cam.cy = Math.max(0, Math.min(mapPxH, cam.cy));
}

export function screenToWorld(cam: Camera, sx: number, sy: number): { x: number; y: number } {
  return {
    x: cam.cx + (sx - cam.viewportW / 2) / cam.zoom,
    y: cam.cy + (sy - cam.viewportH / 2) / cam.zoom,
  };
}

export function worldToTile(wx: number, wy: number): { x: number; y: number } {
  return { x: Math.floor(wx / CONFIG.tileSize), y: Math.floor(wy / CONFIG.tileSize) };
}

export function screenToTile(cam: Camera, sx: number, sy: number): { x: number; y: number } {
  const w = screenToWorld(cam, sx, sy);
  return worldToTile(w.x, w.y);
}

export function visibleTileBounds(cam: Camera): { x0: number; y0: number; x1: number; y1: number } {
  const halfW = cam.viewportW / 2 / cam.zoom;
  const halfH = cam.viewportH / 2 / cam.zoom;
  const x0 = Math.max(0, Math.floor((cam.cx - halfW) / CONFIG.tileSize));
  const y0 = Math.max(0, Math.floor((cam.cy - halfH) / CONFIG.tileSize));
  const x1 = Math.min(CONFIG.mapWidth - 1, Math.ceil((cam.cx + halfW) / CONFIG.tileSize));
  const y1 = Math.min(CONFIG.mapHeight - 1, Math.ceil((cam.cy + halfH) / CONFIG.tileSize));
  return { x0, y0, x1, y1 };
}
