import { presentationCopy, type PresentationCopyKey } from '../config/presentation-copy';
import type { PresentationViewModel } from './presentation-projection';

type Action = 'detection' | 'airplane' | 'revive' | 'failure' | 'retry' | 'replay' | 'next' |
  'dismiss' | 'restart' | 'confirm-restart' | 'claim-benben' | 'defer-benben' |
  'retry-retained' | 'reload' | 'acknowledge-tutorial' | 'toggle-help';
type RewardEntry = {
  readonly coordinate: { readonly x: number; readonly y: number };
  readonly payload: { readonly kind: 'coins'; readonly amount: number } |
    { readonly kind: 'item'; readonly item: 'lucky' | 'detection' | 'revive' | 'airplane'; readonly quantity: number };
  readonly oneTime: boolean;
};
type Receipt = { readonly status: 'proven'; readonly entries: readonly RewardEntry[] } |
  { readonly status: 'insufficient-proof' };
export interface GamePresentationActions {
  submit(action: Action, milestoneId?: string): void;
  airplaneTargetAvailable(): boolean;
}
const milestones = [
  'l1-movement-current-number', 'l2-number-hides-on-leave', 'l3-flag-misclick-protection',
  'l4-one-time-coin-reward', 'l5-failure-retry-first-step-safety', 'first-lucky',
  'first-obstacle', 'first-items', 'first-shop',
] as const;
export type GameMilestone = typeof milestones[number];

function node<K extends keyof HTMLElementTagNameMap>(tag: K, key: PresentationCopyKey): HTMLElementTagNameMap[K] {
  const value = document.createElement(tag);
  value.textContent = presentationCopy(key);
  return value;
}

/** Disposable DOM controls. It owns neither an Attempt nor a command queue. */
export function createGamePresentation(host: HTMLElement, actions: GamePresentationActions) {
  let pendingKey: { key: string; action: string } | null = null;
  let keyboardCompanion: string | null = null;
  let previousPointerAction: string | null = null;
  let busy = false;
  let restartConfirmation = false;
  let benbenDeferred = false;
  let helpOpen = false;
  let lastMilestone: GameMilestone | null = null;
  let lastRender: { view: PresentationViewModel | null; receipt: Receipt | null;
    retainedRetry: boolean; eventMilestone: GameMilestone | null } | null = null;

  function button(key: PresentationCopyKey, action: Action, enabled = true, milestoneId?: string): HTMLButtonElement {
    const value = node('button', key);
    value.type = 'button'; value.dataset.gameAction = action;
    if (milestoneId) value.dataset.milestoneId = milestoneId;
    value.disabled = !enabled;
    return value;
  }
  const actionOf = (target: EventTarget | null) => target instanceof Element
    ? target.closest<HTMLButtonElement>('[data-game-action]') : null;
  function activate(buttonElement: HTMLButtonElement) {
    if (busy || buttonElement.disabled || !host.contains(buttonElement)) return;
    busy = true;
    const action = buttonElement.dataset.gameAction as Action;
    try {
      if (action === 'confirm-restart' || action === 'defer-benben' || action === 'toggle-help') {
        if (action === 'confirm-restart') restartConfirmation = true;
        if (action === 'defer-benben') benbenDeferred = true;
        if (action === 'toggle-help') helpOpen = !helpOpen;
        if (lastRender) render(lastRender.view, lastRender.receipt, lastRender.retainedRetry, lastRender.eventMilestone);
        return;
      }
      if (action === 'reload') { actions.submit('reload'); return; }
      actions.submit(action, buttonElement.dataset.milestoneId);
    } finally { busy = false; }
  }
  host.addEventListener('pointerdown', (event) => {
    const target = actionOf(event.target);
    if (target) previousPointerAction = target.dataset.gameAction ?? null;
  });
  host.addEventListener('click', (event) => {
    const target = actionOf(event.target);
    if (!target) return;
    const action = target.dataset.gameAction!;
    if (keyboardCompanion === action) { keyboardCompanion = null; event.preventDefault(); return; }
    if (event.detail > 1 && previousPointerAction === action) { event.preventDefault(); return; }
    previousPointerAction = action;
    activate(target);
  });
  host.addEventListener('dblclick', (event) => event.preventDefault());
  host.addEventListener('keydown', (event) => {
    const target = actionOf(event.target);
    if (!target || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    if (!event.repeat && pendingKey === null) pendingKey = { key: event.key, action: target.dataset.gameAction! };
  });
  host.addEventListener('keyup', (event) => {
    const target = actionOf(event.target);
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const pending = pendingKey;
    pendingKey = null;
    if (target && pending?.key === event.key && pending.action === target.dataset.gameAction) {
      keyboardCompanion = pending.action;
      activate(target);
      setTimeout(() => { keyboardCompanion = null; }, 0);
    }
  });
  host.addEventListener('focusout', (event) => {
    const target = actionOf(event.target);
    if (target && pendingKey?.action === target.dataset.gameAction) pendingKey = null;
  });

  function render(view: PresentationViewModel | null, receipt: Receipt | null, retainedRetry: boolean,
    eventMilestone: GameMilestone | null = null) {
    lastRender = { view, receipt, retainedRetry, eventMilestone };
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.gameAction : null;
    host.replaceChildren();
    const attempt = view?.attempt;
    if (!attempt) { pendingKey = null; restartConfirmation = false; return; }
    const append = (key: PresentationCopyKey, action: Action, enabled = true, milestone?: string) =>
      host.append(button(key, action, enabled, milestone));
    host.append(node('h3', 'game.items'));
    for (const item of ['detection', 'airplane', 'revive'] as const) {
      const offer = attempt.items[item];
      if (item === 'revive' && attempt.phase !== 'pending-mine-encounter') continue;
      if (item !== 'revive' && attempt.phase !== 'active') continue;
      const label = node('p', `shop.item.${item}`);
      label.textContent += ` — ${presentationCopy(`game.item.resource.${offer.resource}`)}; ` +
        `${presentationCopy('game.item.uses')}: ${offer.usesRemaining}`;
      host.append(label);
      append(`game.item.${item}`, item, offer.offered && (item !== 'airplane' || actions.airplaneTargetAvailable()));
    }
    if (attempt.items.automaticLuckyAvailable) host.append(node('p', 'game.lucky.automatic'));
    if (attempt.phase === 'pending-mine-encounter') {
      host.append(node('p', 'game.pending'));
      append('game.failure', 'failure', attempt.terminal.failure);
    }
    if (attempt.benben.entitlement === 'available' && !benbenDeferred) {
      host.append(node('p', 'game.benben.available'));
      append('game.benben.claim', 'claim-benben', attempt.benben.claimOffered);
      append('game.benben.defer', 'defer-benben');
    } else if (attempt.benben.entitlement === 'used') host.append(node('p', 'game.benben.used'));
    if (attempt.benben.temporaryCard) {
      const label = node('p', attempt.benben.temporaryCard.consumed
        ? 'game.benben.card.consumed' : 'game.benben.card');
      label.textContent += `: ${presentationCopy(`shop.item.${attempt.benben.temporaryCard.item}`)}`;
      host.append(label);
    }
    if (attempt.terminal.retry) append('game.retry', 'retry');
    if (attempt.terminal.replay) append('game.replay', 'replay');
    if (attempt.terminal.next) append('game.next', 'next');
    if (attempt.terminal.dismiss) append('game.dismiss', 'dismiss');
    if (attempt.terminal.restart) {
      if (restartConfirmation) host.append(node('p', 'game.restart.confirm'));
      append(restartConfirmation ? 'nav.confirm' : 'game.restart',
        restartConfirmation ? 'restart' : 'confirm-restart');
    } else restartConfirmation = false;
    if (retainedRetry) append('game.retry-retained', 'retry-retained');
    if (receipt?.status === 'insufficient-proof') host.append(node('p', 'game.rewards.diagnostic'));
    if (receipt?.status === 'proven' && receipt.entries.length > 0) {
      host.append(node('h4', 'game.rewards.receipt'));
      for (const entry of receipt.entries) host.append(rewardLine(entry));
    }
    if (attempt.claimedRewards.length > 0) {
      host.append(node('h4', 'game.rewards.claimed'));
      for (const entry of attempt.claimedRewards) host.append(rewardLine(entry));
    }
    const acknowledged = new Set(view!.tutorialProgress.acknowledgedMilestoneIds);
    const candidates: GameMilestone[] = [];
    if (attempt.levelId === 'level-001') candidates.push('l1-movement-current-number');
    if (attempt.levelId === 'level-003') candidates.push('l3-flag-misclick-protection');
    if (attempt.phase === 'pending-mine-encounter' || attempt.phase === 'failed')
      candidates.push('l5-failure-retry-first-step-safety');
    if (attempt.board.cells.includes('obstacle')) candidates.push('first-obstacle');
    if (attempt.phase === 'active') candidates.push('first-items');
    if (attempt.claimedRewards.some((reward) => reward.oneTime && reward.payload.kind === 'coins'))
      candidates.push('l4-one-time-coin-reward');
    if (eventMilestone) candidates.unshift(eventMilestone);
    const unacknowledged = candidates.filter((id) => !acknowledged.has(id));
    if (unacknowledged.length) {
      host.append(node('h4', 'game.tutorial.title'));
      const chosen = eventMilestone && unacknowledged.includes(eventMilestone) ? eventMilestone :
        lastMilestone && unacknowledged.includes(lastMilestone) ? lastMilestone : unacknowledged[0]!;
      lastMilestone = chosen;
      host.append(node('p', `game.tutorial.${chosen}`));
      if (view!.tutorialAcknowledgmentAllowed) append('game.tutorial.acknowledge', 'acknowledge-tutorial', true, chosen);
    }
    append('game.tutorial.title', 'toggle-help');
    if (helpOpen) for (const id of milestones) {
      if (!acknowledged.has(id)) host.append(node('p', `game.tutorial.${id}`));
    }
    if (focused) host.querySelector<HTMLElement>(`[data-game-action="${focused}"]`)?.focus();
  }
  function rewardLine(entry: RewardEntry) {
    const line = document.createElement('p');
    line.textContent = `${presentationCopy('game.row')} ${entry.coordinate.y + 1}, ` +
      `${presentationCopy('game.column')} ${entry.coordinate.x + 1}: ` + (entry.payload.kind === 'coins'
      ? `${entry.payload.amount} ${presentationCopy('game.rewards.coins')}`
      : `${entry.payload.quantity} ${presentationCopy(`shop.item.${entry.payload.item}`)} ${presentationCopy('game.rewards.item')}`);
    if (entry.oneTime) line.textContent += ` — ${presentationCopy('game.rewards.one-time')}`;
    return line;
  }
  return Object.freeze({ render, clear: () => {
    host.replaceChildren(); pendingKey = null; keyboardCompanion = null;
    restartConfirmation = false; benbenDeferred = false; helpOpen = false; lastRender = null;
  }, afterCommit: () => { restartConfirmation = false; benbenDeferred = false; } });
}
