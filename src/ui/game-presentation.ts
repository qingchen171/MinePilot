import { presentationCopy, type PresentationCopyKey } from '../config/presentation-copy';
import { semanticCopy } from './semantic-copy';
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
export const GAME_TUTORIAL_MILESTONES = [
  'l1-movement-current-number', 'l2-number-hides-on-leave', 'l3-flag-misclick-protection',
  'l4-one-time-coin-reward', 'l5-failure-retry-first-step-safety', 'first-lucky',
  'first-obstacle', 'first-items', 'first-shop',
] as const;
export type GameMilestone = typeof GAME_TUTORIAL_MILESTONES[number];

/** Public contexts for progressive prompts; Help never enumerates future milestones. */
export function gameTutorialContexts(view: PresentationViewModel,
  eventMilestone: GameMilestone | null): { readonly prompt: readonly GameMilestone[]; readonly help: readonly GameMilestone[] } {
  const attempt = view.attempt;
  if (attempt === null) return { prompt: [], help: [] };
  const prompt: GameMilestone[] = [];
  const help: GameMilestone[] = [];
  const add = (id: GameMilestone, auto: boolean) => {
    if (!help.includes(id)) help.push(id);
    if (auto && !prompt.includes(id)) prompt.push(id);
  };
  if (attempt.levelId === 'level-001') add('l1-movement-current-number', true);
  if (attempt.levelId === 'level-002') add('l2-number-hides-on-leave', eventMilestone === 'l2-number-hides-on-leave');
  if (attempt.levelId === 'level-003') add('l3-flag-misclick-protection', true);
  if (attempt.levelId === 'level-004' && attempt.claimedRewards.some((reward) =>
    reward.oneTime && reward.payload.kind === 'coins')) {
    add('l4-one-time-coin-reward', eventMilestone === 'l4-one-time-coin-reward');
  }
  if (attempt.levelId === 'level-005' && (attempt.phase === 'pending-mine-encounter' || attempt.phase === 'failed'))
    add('l5-failure-retry-first-step-safety', true);
  if (attempt.board.cells.includes('obstacle')) add('first-obstacle', true);
  if (attempt.phase === 'active') add('first-items', true);
  if (attempt.position.kind === 'revealed-mine-occupancy' && attempt.itemUses.revive === 0)
    add('first-lucky', eventMilestone === 'first-lucky');
  if (eventMilestone !== null && help.includes(eventMilestone)) {
    const index = prompt.indexOf(eventMilestone);
    if (index >= 0) prompt.splice(index, 1);
    prompt.unshift(eventMilestone);
  }
  return { prompt, help };
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, key: PresentationCopyKey): HTMLElementTagNameMap[K] {
  const value = document.createElement(tag);
  value.textContent = presentationCopy(key);
  return value;
}

/** Disposable DOM controls. It owns neither an Attempt nor a command queue. */
export function createGamePresentation(host: HTMLElement, actions: GamePresentationActions) {
  let pendingKey: { key: string; action: string } | null = null;
  let keyboardCompanion: string | null = null;
  let busy = false;
  let restartConfirmation = false;
  let benbenDeferred = false;
  let helpOpen = false;
  let tutorialOpen = false;
  let lastMilestone: GameMilestone | null = null;
  let lastRender: { view: PresentationViewModel | null; receipt: Receipt | null;
    retainedRetry: boolean; reloadRequired: boolean; eventMilestone: GameMilestone | null;
    authorityDirty: boolean } | null = null;

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
        if (lastRender) render(lastRender.view, lastRender.receipt, lastRender.retainedRetry,
          lastRender.reloadRequired, lastRender.eventMilestone, lastRender.authorityDirty);
        return;
      }
      if (action === 'reload') { actions.submit('reload'); return; }
      actions.submit(action, buttonElement.dataset.milestoneId);
    } finally { busy = false; }
  }
  host.addEventListener('click', (event) => {
    const target = actionOf(event.target);
    if (!target) return;
    const action = target.dataset.gameAction!;
    if (keyboardCompanion === action) { keyboardCompanion = null; event.preventDefault(); return; }
    if (event.detail > 1) { event.preventDefault(); return; }
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
    reloadRequired: boolean,
    eventMilestone: GameMilestone | null = null, authorityDirty = false) {
    lastRender = { view, receipt, retainedRetry, reloadRequired, eventMilestone, authorityDirty };
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.gameAction : null;
    host.replaceChildren();
    const attempt = view?.attempt;
    if (!attempt) { pendingKey = null; restartConfirmation = false; return; }
    const decisions = document.createElement('div'); decisions.className = 'game-decisions'; host.append(decisions);
    const append = (key: PresentationCopyKey, action: Action, enabled = true, milestone?: string) =>
      decisions.append(button(key, action, enabled && (!reloadRequired || action === 'reload') &&
        (!authorityDirty || action === 'reload' || action === 'retry-retained'), milestone));
    host.append(node('h3', 'game.items'));
    const cards = document.createElement('div'); cards.className = 'game-item-cards'; host.append(cards);
    for (const item of ['detection', 'airplane', 'revive'] as const) {
      const offer = attempt.items[item];
      const card = document.createElement('div'); card.className = `game-item-card item-${item}`;
      const label = node('p', `shop.item.${item}`);
      label.textContent = semanticCopy('game.item-status', { item, resource: offer.resource,
        uses: offer.usesRemaining });
      const use = button(`game.item.${item}`, item, offer.offered && !reloadRequired && !authorityDirty &&
        (item !== 'airplane' || actions.airplaneTargetAvailable()));
      card.append(label);
      if (item !== 'revive' && attempt.phase === 'active') card.append(use);
      cards.append(card);
    }
    const lucky = document.createElement('div'); lucky.className = 'game-item-card item-lucky';
    lucky.append(node('p', 'shop.item.lucky'));
    lucky.append(node('p', attempt.items.automaticLuckyAvailable ? 'game.lucky.automatic' : 'game.lucky.unavailable'));
    cards.append(lucky);
    if (attempt.phase === 'pending-mine-encounter') {
      decisions.append(node('p', 'game.pending'));
      append('game.item.revive', 'revive', attempt.items.revive.offered);
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
      label.textContent = semanticCopy(attempt.benben.temporaryCard.consumed
        ? 'game.temporary-card-used' : 'game.temporary-card', { item: attempt.benben.temporaryCard.item });
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
    if (reloadRequired || authorityDirty) append('action.reload', 'reload');
    if (receipt?.status === 'insufficient-proof') host.append(node('p', 'game.rewards.diagnostic'));
    if (eventMilestone === 'first-lucky') host.append(node('p', 'game.lucky.saved'));
    if (receipt?.status === 'proven' && receipt.entries.length > 0) {
      host.append(node('h4', 'game.rewards.receipt'));
      for (const entry of receipt.entries) host.append(rewardLine(entry));
    }
    if (attempt.claimedRewards.length > 0) {
      const history = document.createElement('details');
      const summary = document.createElement('summary'); summary.append(node('h4', 'game.rewards.claimed'));
      history.append(summary);
      for (const entry of attempt.claimedRewards) history.append(rewardLine(entry));
      host.append(history);
    }
    const acknowledged = new Set(view!.tutorialProgress.acknowledgedMilestoneIds);
    const contexts = gameTutorialContexts(view!, eventMilestone);
    const unacknowledged = contexts.prompt.filter((id) => !acknowledged.has(id));
    // Preserve this operation's unacknowledged event prompt across disposable DOM redraws,
    // but never reconstruct it from persisted facts after route exit or reload.
    const retainedPrompt = lastMilestone !== null && contexts.help.includes(lastMilestone) &&
      !acknowledged.has(lastMilestone) ? lastMilestone : null;
    if (unacknowledged.length || retainedPrompt !== null) {
      const tutorial = document.createElement('details');
      tutorial.className = 'game-tutorial-drawer'; tutorial.open = tutorialOpen;
      tutorial.addEventListener('toggle', () => { if (host.contains(tutorial)) tutorialOpen = tutorial.open; });
      tutorial.append(node('summary', 'game.tutorial.title')); host.append(tutorial);
      const chosen = eventMilestone && unacknowledged.includes(eventMilestone) ? eventMilestone :
        retainedPrompt ?? unacknowledged[0]!;
      lastMilestone = chosen;
      tutorial.append(node('p', `game.tutorial.${chosen}`));
      if (view!.tutorialAcknowledgmentAllowed) tutorial.append(button('game.tutorial.acknowledge',
        'acknowledge-tutorial', !reloadRequired && !authorityDirty, chosen));
    }
    append('game.tutorial.title', 'toggle-help');
    if (helpOpen) for (const id of contexts.help) {
      if (!acknowledged.has(id)) host.append(node('p', `game.tutorial.${id}`));
    }
    if (focused) {
      const retained = host.querySelector<HTMLButtonElement>(`[data-game-action="${focused}"]`);
      (retained !== null && !retained.disabled ? retained :
        host.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus();
    }
  }
  function rewardLine(entry: RewardEntry) {
    const line = document.createElement('p');
    line.textContent = entry.payload.kind === 'coins'
      ? semanticCopy(entry.payload.amount === 1
        ? entry.oneTime ? 'reward.coins-single-one-time' : 'reward.coins-single'
        : entry.oneTime ? 'reward.coins-plural-one-time' : 'reward.coins-plural',
        { row: entry.coordinate.y + 1, column: entry.coordinate.x + 1,
          amount: entry.payload.amount })
      : semanticCopy(entry.payload.quantity === 1
        ? entry.oneTime ? 'reward.item-single-one-time' : 'reward.item-single'
        : entry.oneTime ? 'reward.item-plural-one-time' : 'reward.item-plural',
        { row: entry.coordinate.y + 1, column: entry.coordinate.x + 1,
          amount: entry.payload.quantity, item: entry.payload.item });
    return line;
  }
  return Object.freeze({ render, clear: () => {
    host.replaceChildren(); pendingKey = null; keyboardCompanion = null;
    restartConfirmation = false; benbenDeferred = false; helpOpen = false; tutorialOpen = false; lastMilestone = null; lastRender = null;
  }, afterCommit: () => { restartConfirmation = false; benbenDeferred = false; } });
}
