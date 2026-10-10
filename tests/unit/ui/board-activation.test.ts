import { describe, expect, it } from 'vitest';
import { createBoardActivationGate } from '../../../src/ui/board-activation';

describe('native board activation gate', () => {
  it('rejects same-target native multi-click continuation after synchronous completion but allows a distinct target', () => {
    const gate = createBoardActivationGate();
    const a = { x: 1, y: 2 }; const b = { x: 2, y: 2 };
    expect(gate.pointer(a, 1)).toBe(true);
    expect(gate.pointer(a, 2)).toBe(false);
    expect(gate.pointer(b, 2)).toBe(true);
    gate.reset();
    expect(gate.pointer(a, 1)).toBe(true);
  });

  it('submits one keyboard down/up and suppresses the companion synthetic click', () => {
    const gate = createBoardActivationGate(); const target = { x: 0, y: 0 };
    expect(gate.keyDown(target, 'Enter', false)).toBe(true);
    expect(gate.keyDown(target, 'Enter', true)).toBe(false);
    expect(gate.keyUp(target, 'Enter')).toBe(true);
    expect(gate.keyUp(target, 'Enter')).toBe(false);
    expect(gate.consumeCompanionClick(target, 0)).toBe(true);
    expect(gate.consumeCompanionClick(target, 0)).toBe(false);
    expect(gate.pointer(target, 0)).toBe(true);
  });

  it('consumes a touch compatibility click from a contextmenu, but permits a new press', () => {
    const gate = createBoardActivationGate(); const target = { x: 3, y: 4 };
    gate.newPress(); gate.markContextMenu(target);
    expect(gate.consumeContextClick(target)).toBe(true);
    expect(gate.consumeContextClick(target)).toBe(false);
    gate.markContextMenu(target);
    gate.newPress();
    expect(gate.consumeContextClick(target)).toBe(false);
  });
});
