import { presentationCopy, type PresentationCopyKey } from '../config/presentation-copy';
import type { LevelListProjectionInput } from './level-list-projection';
import type { PresentationViewModel } from './presentation-projection';

export type PublicPage = 'home' | 'levels' | 'game' | 'shop' | 'settings' | 'feedback' | 'recovery';
export interface NavigationPageActions {
  navigate(page: PublicPage): void;
  selectLevel(levelId: string): void;
  confirmReplacement(): void;
  cancelReplacement(): void;
  retryReplacement(): void;
  leaveForShop(): void;
  setSetting(key: 'musicEnabled' | 'soundEffectsEnabled', enabled: boolean): void;
  reload(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, key: PresentationCopyKey): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = presentationCopy(key);
  return node;
}
function button(key: PresentationCopyKey, action: () => void, id: string): HTMLButtonElement {
  const node = el('button', key);
  node.type = 'button';
  node.dataset.action = id;
  node.addEventListener('keydown', (event) => { if (event.repeat) event.preventDefault(); });
  node.addEventListener('click', action);
  return node;
}
const ROUTES: readonly { readonly page: PublicPage; readonly key: PresentationCopyKey }[] = [
  { page: 'home', key: 'nav.home' }, { page: 'levels', key: 'nav.levels' },
  { page: 'game', key: 'nav.game' }, { page: 'shop', key: 'nav.shop' },
  { page: 'settings', key: 'nav.settings' }, { page: 'feedback', key: 'nav.feedback' },
];

/** DOM-only, disposable view. All route and mutation decisions are supplied by the application root. */
export function renderNavigationPages(nav: HTMLElement, page: HTMLElement, route: PublicPage,
  view: PresentationViewModel | null, levels: readonly LevelListProjectionInput[] | null,
  confirmation: { readonly target: string; readonly phase: string } | null,
  actions: NavigationPageActions, message: PresentationCopyKey | null = null): void {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const previous = active?.dataset.action;
  const hadPageFocus = active !== null && (active.dataset.action !== undefined ||
    active.dataset.levelId !== undefined || active.dataset.setting !== undefined);
  nav.replaceChildren();
  page.replaceChildren();
  if (view === null && route !== 'feedback') route = 'recovery';
  for (const item of ROUTES) {
    if (view === null && item.page !== 'feedback') continue;
    const control = button(item.key, () => actions.navigate(item.page), `route-${item.page}`);
    control.setAttribute('aria-current', item.page === route ? 'page' : 'false');
    nav.append(control);
  }
  const title = ROUTES.find((item) => item.page === route)?.key ?? 'nav.recovery';
  const heading = el('h2', title);
  heading.tabIndex = -1;
  page.append(heading);
  if (message !== null) {
    const note = el('p', message);
    note.setAttribute('role', 'status');
    page.append(note);
  }
  if (route === 'recovery') {
    page.append(el('p', 'recovery.note'));
    page.append(button('action.reload', actions.reload, 'reload'));
    page.append(button('nav.feedback', () => actions.navigate('feedback'), 'route-feedback'));
  } else if (route === 'home' && view) {
    page.append(el('h3', 'home.account'));
    const coins = document.createElement('p');
    coins.textContent = `${presentationCopy('shop.balance')}: ${view.account.coins}`;
    page.append(coins);
    page.append(el('p', view.attempt ? 'home.attempt' : 'home.no-attempt'));
    if (view.attempt) page.append(button('nav.continue', () => actions.navigate('game'), 'continue'));
    page.append(button('nav.levels', () => actions.navigate('levels'), 'route-levels'));
  } else if (route === 'levels' && view) {
    if (confirmation?.phase === 'confirm') {
      page.append(el('p', 'nav.confirm-replace'));
      const target = document.createElement('p'); target.textContent = confirmation.target; page.append(target);
      page.append(button('nav.confirm', actions.confirmReplacement, 'confirm-replacement'));
      page.append(button('nav.cancel', actions.cancelReplacement, 'cancel-replacement'));
    } else if (confirmation?.phase === 'first-retry' || confirmation?.phase === 'second-retry') {
      page.append(button('action.retry', actions.retryReplacement, 'retry-replacement'));
      page.append(button('nav.cancel', actions.cancelReplacement, 'cancel-replacement'));
    } else for (const entry of levels ?? []) {
      const row = document.createElement('div');
      const control = document.createElement('button');
      control.type = 'button'; control.dataset.levelId = entry.levelId;
      control.textContent = `${entry.levelId} — ${presentationCopy(entry.access === 'locked' ? 'nav.locked' :
        entry.access === 'completed' ? 'nav.completed' : 'nav.available')}`;
      control.disabled = entry.access === 'locked';
      control.addEventListener('click', () => actions.selectLevel(entry.levelId));
      row.append(control);
      if (entry.current) row.append(el('span', 'nav.current'));
      page.append(row);
    }
  } else if (route === 'game' && view) {
    page.append(el('p', 'game.placeholder'));
    if (view.attempt) {
      const current = document.createElement('p'); current.textContent = view.attempt.levelId; page.append(current);
      page.append(button('nav.leave-for-shop', actions.leaveForShop, 'leave-for-shop'));
    } else page.append(button('nav.levels', () => actions.navigate('levels'), 'route-levels'));
  } else if (route === 'settings' && view) {
    for (const [key, copy] of [['musicEnabled', 'settings.music'], ['soundEffectsEnabled', 'settings.effects']] as const) {
      const label = document.createElement('label');
      const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.setting = key;
      input.checked = view.settings[key];
      input.addEventListener('change', () => actions.setSetting(key, input.checked));
      label.append(input, document.createTextNode(presentationCopy(copy))); page.append(label);
    }
  } else if (route === 'feedback') {
    page.append(el('p', 'feedback.note'));
    const link = el('a', 'feedback.open-mail');
    link.href = 'mailto:qingchen6757@gmail.com';
    link.dataset.action = 'feedback-mail'; page.append(link);
    if (view === null) page.append(button('nav.recovery', () => actions.navigate('recovery'), 'route-recovery'));
  }
  if (previous) {
    const next = [...nav.querySelectorAll<HTMLElement>('[data-action]'),
      ...page.querySelectorAll<HTMLElement>('[data-action]')].find((node) => node.dataset.action === previous);
    if (next) { next.focus(); return; }
  }
  if (hadPageFocus) heading.focus();
}
