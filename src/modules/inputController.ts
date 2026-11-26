import { InputVector } from '../types/reag';

const KEY_TO_DIRECTION: Record<string, keyof InputVector> = {
  ArrowUp: 'up',
  KeyW: 'up',
  KeyZ: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  KeyQ: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

export class RuntimeInputController {
  private vector: InputVector = {
    up: false,
    down: false,
    left: false,
    right: false,
  };

  getVector(): InputVector {
    return this.vector;
  }

  setDirection(dir: keyof InputVector, active: boolean): void {
    this.vector[dir] = active;
  }

  handleKeyDown(code: string): boolean {
    const dir = KEY_TO_DIRECTION[code];
    if (!dir) return false;
    this.vector[dir] = true;
    return true;
  }

  handleKeyUp(code: string): boolean {
    const dir = KEY_TO_DIRECTION[code];
    if (!dir) return false;
    this.vector[dir] = false;
    return true;
  }

  handlePointerCancel(dir: keyof InputVector): void {
    this.vector[dir] = false;
  }

  handleLostPointerCapture(dir: keyof InputVector): void {
    this.vector[dir] = false;
  }

  resetAll(): void {
    this.vector.up = false;
    this.vector.down = false;
    this.vector.left = false;
    this.vector.right = false;
  }
}
