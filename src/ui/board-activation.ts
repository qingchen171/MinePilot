export interface BoardTarget { readonly x: number; readonly y: number }
const same = (a: BoardTarget | null, b: BoardTarget) => a !== null && a.x === b.x && a.y === b.y;

/** Native-event correlation, not an elapsed-time debounce or gameplay queue. */
export function createBoardActivationGate() {
  let lastPointer: BoardTarget | null = null;
  let keyboard: { readonly target: BoardTarget; readonly key: string } | null = null;
  let companionClick: BoardTarget | null = null;
  let cancelledKey: string | null = null;
  let cancelledClick: BoardTarget | null = null;
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
      cancelledKey = null; cancelledClick = null;
      keyboard = { target, key };
      return true;
    },
    keyUp(target: BoardTarget, key: string): boolean {
      if (keyboard === null) {
        if (cancelledKey === key) { cancelledKey = null; cancelledClick = target; }
        return false;
      }
      if (keyboard.key !== key) return false;
      const matches = same(keyboard.target, target);
      keyboard = null;
      if (!matches) { cancelledClick = target; return false; }
      companionClick = target;
      return true;
    },
    cancelKeyboard(): void {
      if (keyboard !== null) cancelledKey = keyboard.key;
      keyboard = null;
    },
    consumeCompanionClick(target: BoardTarget, detail: number): boolean {
      if (detail !== 0) return false;
      if (same(cancelledClick, target)) { cancelledClick = null; return true; }
      if (!same(companionClick, target)) return false;
      companionClick = null;
      return true;
    },
    clearCompanion(): void { companionClick = null; cancelledClick = null; },
    reset(): void {
      lastPointer = null; keyboard = null; companionClick = null;
      cancelledKey = null; cancelledClick = null; contextCompanion = null;
    },
  });
}
