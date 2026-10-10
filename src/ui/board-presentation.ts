import { presentationCopy } from '../config/presentation-copy';
import { createBoardActivationGate, type BoardTarget } from './board-activation';
import { boardCellRect, type BoardLayout } from './board-layout';
import type { PresentationViewModel } from './presentation-projection';

type Attempt = NonNullable<PresentationViewModel['attempt']>;
export type BoardAction = { readonly kind: 'move' | 'flag'; readonly coordinate: BoardTarget; readonly flagged?: boolean };
const cellKey = {
  unknown: 'game.cell.unknown', flagged: 'game.cell.flagged', explored: 'game.cell.explored',
  obstacle: 'game.cell.obstacle', 'revealed-mine': 'game.cell.revealed-mine',
} as const;

/** Disposable DOM hit surface. It consumes only public facts; Phaser never submits input. */
export function createBoardPresentation(stage: HTMLElement, controls: HTMLElement,
  submit: (action: BoardAction) => void, focusFallback: () => void) {
  const grid = document.createElement('div');
  grid.className = 'board-hit-grid';
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', presentationCopy('game.board-label'));
  stage.append(grid);
  const gate = createBoardActivationGate();
  let attempt: Attempt | null = null;
  let selected: BoardTarget | null = null;
  let touchMode: 'move' | 'flag' = 'move';
  let pointerType = 'mouse';
  let pointerTarget: BoardTarget | null = null;
  let secondaryPressCount = 1;
  let enabled = false;
  let cells: HTMLButtonElement[] = [];
  const number = document.createElement('p'); number.className = 'board-current-number';
  const phase = document.createElement('p'); phase.className = 'board-phase';
  const positionLabel = document.createElement('p'); positionLabel.className = 'board-position';
  const selectedLabel = document.createElement('p'); selectedLabel.className = 'board-selected';
  const flag = document.createElement('button'); flag.type = 'button'; flag.dataset.action = 'board-flag';
  flag.textContent = presentationCopy('game.flag-target');
  const moveMode = document.createElement('button'); moveMode.type = 'button'; moveMode.dataset.action = 'touch-move';
  moveMode.textContent = presentationCopy('game.mode.move');
  const flagMode = document.createElement('button'); flagMode.type = 'button'; flagMode.dataset.action = 'touch-flag';
  flagMode.textContent = presentationCopy('game.mode.flag');
  const modes = document.createElement('div'); modes.className = 'board-touch-modes'; modes.append(moveMode, flagMode);
  controls.append(phase, positionLabel, number, selectedLabel, flag, modes);

  function targetOf(element: Element | null): BoardTarget | null {
    const cell = element?.closest<HTMLButtonElement>('[data-cell-index]');
    if (cell == null || !grid.contains(cell) || attempt === null) return null;
    const index = Number(cell.dataset.cellIndex);
    if (!Number.isInteger(index) || index < 0 || index >= attempt.board.cells.length) return null;
    return { x: index % attempt.board.width, y: Math.floor(index / attempt.board.width) };
  }
  function indexOf(target: BoardTarget) { return attempt === null ? -1 : target.y * attempt.board.width + target.x; }
  function updateSelection() {
    for (const [index, cell] of cells.entries()) {
      if (cell === undefined) continue;
      cell.dataset.selected = selected !== null && index === indexOf(selected) ? 'true' : 'false';
    }
    flag.disabled = !enabled || selected === null;
    selectedLabel.textContent = selected === null ? presentationCopy('game.no-target') :
      `${presentationCopy('game.selected')} ${selected.y + 1}, ${selected.x + 1}`;
  }
  function select(target: BoardTarget) { selected = target; updateSelection(); }
  function perform(kind: 'move' | 'flag', target: BoardTarget) {
    if (!enabled || attempt === null) return;
    const appearance = attempt.board.cells[indexOf(target)];
    if (appearance === undefined) return;
    submit(kind === 'move' ? { kind, coordinate: target } :
      { kind, coordinate: target, flagged: appearance !== 'flagged' });
  }
  grid.addEventListener('pointerdown', (event) => {
    const target = targetOf(event.target instanceof Element ? event.target : null);
    if (target === null) return;
    gate.newPress();
    pointerType = event.pointerType; pointerTarget = target; select(target);
  });
  grid.addEventListener('mousedown', (event) => {
    if (event.button === 2) secondaryPressCount = event.detail;
  });
  grid.addEventListener('pointerover', (event) => {
    const target = targetOf(event.target instanceof Element ? event.target : null);
    if (target !== null && event.pointerType === 'mouse') select(target);
  });
  grid.addEventListener('focusin', (event) => {
    const target = targetOf(event.target instanceof Element ? event.target : null);
    if (target !== null) select(target);
  });
  grid.addEventListener('click', (event) => {
    const target = targetOf(event.target instanceof Element ? event.target : null);
    if (target === null || !enabled || gate.consumeContextClick(target) ||
        gate.consumeCompanionClick(target, event.detail)) return;
    const fromTouch = pointerType === 'touch' && pointerTarget?.x === target.x && pointerTarget?.y === target.y;
    if (!gate.pointer(target, event.detail)) return;
    perform(fromTouch && touchMode === 'flag' ? 'flag' : 'move', target);
    pointerTarget = null;
  });
  grid.addEventListener('contextmenu', (event) => {
    const target = targetOf(event.target instanceof Element ? event.target : null);
    if (target === null) return;
    event.preventDefault();
    if (pointerTarget?.x === target.x && pointerTarget?.y === target.y) gate.markContextMenu(target);
    if (enabled && gate.pointer(target, secondaryPressCount)) perform('flag', target);
    secondaryPressCount = 1;
  });
  grid.addEventListener('dblclick', (event) => event.preventDefault());
  grid.addEventListener('keydown', (event) => {
    const target = targetOf(event.target instanceof Element ? event.target : null);
    if (target === null) return;
    const delta = event.key === 'ArrowLeft' ? [-1, 0] : event.key === 'ArrowRight' ? [1, 0] :
      event.key === 'ArrowUp' ? [0, -1] : event.key === 'ArrowDown' ? [0, 1] : null;
    if (delta !== null && attempt !== null) {
      event.preventDefault();
      const x = Math.max(0, Math.min(attempt.board.width - 1, target.x + delta[0]!));
      const y = Math.max(0, Math.min(attempt.board.height - 1, target.y + delta[1]!));
      cells[y * attempt.board.width + x]?.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); gate.keyDown(target, event.key, event.repeat);
    }
  });
  grid.addEventListener('keyup', (event) => {
    const target = targetOf(event.target instanceof Element ? event.target : null);
    if (target === null || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    if (gate.keyUp(target, event.key)) {
      perform('move', target);
      setTimeout(() => gate.clearCompanion(), 0);
    }
  });
  flag.addEventListener('keydown', (event) => { if (event.repeat) event.preventDefault(); });
  flag.addEventListener('click', (event) => {
    if (selected === null || !enabled || !gate.pointer(selected, event.detail)) return;
    perform('flag', selected);
  });
  moveMode.addEventListener('click', () => { touchMode = 'move'; showMode(); });
  flagMode.addEventListener('click', () => { touchMode = 'flag'; showMode(); });
  function showMode() {
    moveMode.setAttribute('aria-pressed', String(touchMode === 'move'));
    flagMode.setAttribute('aria-pressed', String(touchMode === 'flag'));
  }
  showMode();

  function render(next: Attempt | null, currentNumber: PresentationViewModel['currentNumberDisplay'],
    layout: BoardLayout | null) {
    if (next === null || layout === null) { clear(); return; }
    if (attempt?.board.width !== next.board.width || attempt?.board.height !== next.board.height) {
      grid.replaceChildren(); cells = [];
      for (let index = 0; index < next.board.cells.length; index += 1) {
        const cell = document.createElement('button'); cell.type = 'button'; cell.dataset.cellIndex = String(index);
        cell.className = 'board-hit-cell'; cell.setAttribute('role', 'gridcell');
        grid.append(cell); cells.push(cell);
      }
      selected = null; gate.reset();
    }
    attempt = next;
    enabled = next.phase === 'active';
    grid.style.left = `${layout.originX}px`; grid.style.top = `${layout.originY}px`;
    grid.style.width = `${layout.columns * layout.cellSize}px`;
    grid.style.height = `${layout.rows * layout.cellSize}px`;
    phase.textContent = presentationCopy(`game.phase.${next.phase}`);
    positionLabel.textContent = next.position.kind === 'waiting' ? presentationCopy('game.position.waiting') :
      `${presentationCopy(`game.position.${next.position.kind}`)} ${next.position.y + 1}, ${next.position.x + 1}`;
    number.textContent = currentNumber.kind === 'number' ?
      `${presentationCopy('game.current-number')} ${currentNumber.value}` :
      currentNumber.kind === 'zero-feedback' ? presentationCopy('game.zero-feedback') : '';
    for (const [index, cell] of cells.entries()) {
      const x = index % next.board.width; const y = Math.floor(index / next.board.width);
      const rect = boardCellRect(layout, x, y)!;
      const appearance = next.board.cells[index]!;
      cell.style.left = `${rect.x - layout.originX}px`; cell.style.top = `${rect.y - layout.originY}px`;
      cell.style.width = `${rect.width}px`; cell.style.height = `${rect.height}px`;
      cell.dataset.appearance = appearance;
      const occupied = next.position.kind !== 'waiting' && next.position.x === x && next.position.y === y;
      cell.dataset.character = String(occupied);
      cell.setAttribute('aria-label', `${presentationCopy('game.row')} ${y + 1}, ${presentationCopy('game.column')} ${x + 1}, ${presentationCopy(cellKey[appearance])}${occupied ? `, ${presentationCopy('game.character-here')}` : ''}`);
      cell.disabled = !enabled;
    }
    updateSelection();
  }
  function clear() {
    invalidateAuthority();
    attempt = null; enabled = false; selected = null; pointerTarget = null; gate.reset();
    grid.replaceChildren(); cells = []; flag.disabled = true;
    number.textContent = ''; phase.textContent = ''; positionLabel.textContent = ''; selectedLabel.textContent = '';
  }
  function invalidateAuthority() {
    if (document.activeElement instanceof Node && grid.contains(document.activeElement)) focusFallback();
    enabled = false; selected = null; pointerTarget = null; gate.reset(); updateSelection();
  }
  return Object.freeze({ render, clear, invalidateAuthority });
}
