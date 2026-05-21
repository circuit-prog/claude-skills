import type { SpeedSetting } from '../world/world.ts';

export interface PointerState {
  x: number;            // canvas pixel coords
  y: number;
  worldX: number;       // world tile coords (float)
  worldY: number;
  down: boolean;
  dragStartX: number;
  dragStartY: number;
  isDragging: boolean;
}

export interface InputState {
  pointer: PointerState;
  keys: Set<string>;
}

export function createInputState(): InputState {
  return {
    pointer: { x: 0, y: 0, worldX: 0, worldY: 0, down: false, dragStartX: 0, dragStartY: 0, isDragging: false },
    keys: new Set(),
  };
}

const DRAG_THRESHOLD_PX = 4;

export interface BindOptions {
  canvas: HTMLCanvasElement;
  getSpeed: () => SpeedSetting;
  onPan(dxScreen: number, dyScreen: number): void;
  onZoom(deltaPx: number, anchorX: number, anchorY: number): void;
  onClick(canvasX: number, canvasY: number): void;
  onSpeed(speed: SpeedSetting): void;
}

export function bindInput(input: InputState, opts: BindOptions): () => void {
  const { canvas, getSpeed, onPan, onZoom, onClick, onSpeed } = opts;

  const onPointerDown = (e: PointerEvent) => {
    input.pointer.down = true;
    input.pointer.isDragging = false;
    input.pointer.dragStartX = e.clientX;
    input.pointer.dragStartY = e.clientY;
    input.pointer.x = e.clientX;
    input.pointer.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    const prevX = input.pointer.x;
    const prevY = input.pointer.y;
    input.pointer.x = e.clientX;
    input.pointer.y = e.clientY;
    if (input.pointer.down) {
      const dx = e.clientX - input.pointer.dragStartX;
      const dy = e.clientY - input.pointer.dragStartY;
      if (!input.pointer.isDragging && (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX)) {
        input.pointer.isDragging = true;
      }
      if (input.pointer.isDragging) {
        onPan(e.clientX - prevX, e.clientY - prevY);
      }
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (input.pointer.down && !input.pointer.isDragging) {
      onClick(e.clientX, e.clientY);
    }
    input.pointer.down = false;
    input.pointer.isDragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    onZoom(e.deltaY, e.clientX, e.clientY);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    input.keys.add(e.key);
    switch (e.key) {
      case ' ':
        e.preventDefault();
        onSpeed(getSpeed() === 0 ? 1 : 0);
        break;
      case '1': onSpeed(1); break;
      case '2': onSpeed(2); break;
      case '3': onSpeed(4); break;
    }
  };

  const onKeyUp = (e: KeyboardEvent) => { input.keys.delete(e.key); };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}
