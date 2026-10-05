import { presentationCopy, type PresentationCopyKey } from '../config/presentation-copy';
import type { PresentationViewModel } from './presentation-projection';

type Offer = PresentationViewModel['shop']['offers'][number];
export interface ShopPresentationActions {
  readonly purchase: (item: Offer['item']) => void;
  readonly buyAgain: () => void;
  readonly retry: () => void;
  readonly reload: () => void;
}

const ITEM_KEYS: Record<Offer['item'], PresentationCopyKey> = {
  lucky: 'shop.item.lucky', detection: 'shop.item.detection',
  revive: 'shop.item.revive', airplane: 'shop.item.airplane',
};

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

/** DOM-only rendering of sanitized ViewModel facts. No price, inventory or persistence rule lives here. */
export function renderShopPanel(root: HTMLElement, view: PresentationViewModel,
  control: 'ready' | 'submitting' | 'receipt-disarmed', actions: ShopPresentationActions,
  message: PresentationCopyKey | null = null,
  availableActions: { readonly buyAgain: boolean; readonly retry: boolean; readonly reload: boolean } = {
    buyAgain: false, retry: false, reload: false,
  }): void {
  root.replaceChildren();
  root.append(element('h2', presentationCopy('shop.title')));
  root.append(element('p', `${presentationCopy('shop.balance')}: ${view.account.coins}`));
  if (view.shop.status !== 'available') {
    root.append(element('p', presentationCopy(view.shop.status === 'account-only' ? 'shop.account-only' : 'shop.unavailable')));
    return;
  }
  if (message !== null) root.append(element('p', presentationCopy(message)));
  if (control === 'receipt-disarmed') {
    const action = availableActions.buyAgain ? 'buy-again' : availableActions.retry ? 'retry' : 'reload';
    const key = action === 'buy-again' ? 'shop.buy-again' : action === 'retry' ? 'action.retry' : 'action.reload';
    const button = element('button', presentationCopy(key));
    button.type = 'button';
    button.dataset.shopAction = action;
    button.addEventListener('keydown', (event) => { if (event.repeat) event.preventDefault(); });
    button.addEventListener('click', () => {
      if (action === 'buy-again') actions.buyAgain();
      else if (action === 'retry') actions.retry();
      else actions.reload();
    });
    root.append(button);
    return;
  }
  for (const offer of view.shop.offers) {
    const row = document.createElement('div');
    row.append(element('span', `${presentationCopy(ITEM_KEYS[offer.item])} — ${offer.price} ${presentationCopy('shop.coin')} · ${presentationCopy('shop.owned')}: ${offer.owned} `));
    const buy = element('button', presentationCopy('shop.buy'));
    buy.type = 'button';
    buy.dataset.shopItem = offer.item;
    buy.disabled = control !== 'ready' || !offer.affordable;
    buy.addEventListener('keydown', (event) => { if (event.repeat) event.preventDefault(); });
    buy.addEventListener('click', () => actions.purchase(offer.item));
    row.append(buy);
    if (!offer.affordable) row.append(element('span', presentationCopy('shop.unaffordable')));
    root.append(row);
  }
}

export function renderShopRecoveryPanel(root: HTMLElement, reload: () => void): void {
  root.replaceChildren();
  root.append(element('p', presentationCopy('status.unavailable')));
  const button = element('button', presentationCopy('action.reload'));
  button.type = 'button';
  button.addEventListener('click', reload);
  root.append(button);
}
