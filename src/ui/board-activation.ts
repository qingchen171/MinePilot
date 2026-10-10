export interface BoardTarget { readonly x: number; readonly y: number }
const same = (a: BoardTarget | null, b: BoardTarget) => a !== null && a.x === b.x && a.y === b.y;

/** Native-event correlation, not an elapsed-time debounce or gameplay queue. */
export function createBoardActivationGate() {
  let lastPointer: BoardTarget | null = null;
  let keyboard: { readonly target: BoardTarget; readonly key: string } | null = null;
  let companionClick: BoardTarget | null = null;
  let contextCompanion: BoardTarget | null = null;
  return Object.freeze({
    newPress(): void { contextCompanion = null; },
    markContextMenu(target: BoardTarget): void { contextCompanion = target; },
    consumeContextClick(target: BoardTarget): boolean {
      if (!same(contextCompanion, target)) return false;
      contextCompanion = null;
      return true;
    },
    pointer(target: BoardTarget, detail: number): boolean {
      if (detail > 1 && same(lastPointer, target)) return false;
      lastPointer = target;
      return true;
    },
    keyDown(target: BoardTarget, key: string, repeat: boolean): boolean {
      if (repeat || keyboard !== null) return false;
      keyboard = { target, key };
      return true;
    },
    keyUp(target: BoardTarget, key: string): boolean {
      if (keyboard === null || keyboard.key !== key || !same(keyboard.target, target)) return false;
      keyboard = null;
      companionClick = target;
      return true;
    },
    consumeCompanionClick(target: BoardTarget, detail: number): boolean {
      if (detail !== 0 || !same(companionClick, target)) return false;
      companionClick = null;
      return true;
    },
    clearCompanion(): void { companionClick = null; },
    reset(): void { lastPointer = null; keyboard = null; companionClick = null; contextCompanion = null; },
  });
}
