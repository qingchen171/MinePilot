import { PRESENTATION_TEMPLATES } from '../config/presentation-copy-templates';
import { presentationCopy } from '../config/presentation-copy';

type Item = 'lucky' | 'detection' | 'revive' | 'airplane';
type Cell = 'unknown' | 'flagged' | 'explored' | 'obstacle' | 'revealed-mine';
type Params = {
  'board.selected': { row: number; column: number };
  'board.position': { row: number; column: number };
  'board.mine-position': { row: number; column: number };
  'board.current-number': { count: number };
  'board.cell': { row: number; column: number; appearance: Cell };
  'board.cell-occupied': { row: number; column: number; appearance: Cell };
  'shop.balance-sentence': { coins: number };
  'shop.offer-single': { item: Item; price: number; owned: number };
  'shop.offer-plural': { item: Item; price: number; owned: number };
  'level.entry': { levelId: string; access: 'locked' | 'completed' | 'available' };
  'level.current': { levelId: string };
  'level.confirm-target': { levelId: string };
  'game.item-status': { item: Item; resource: 'temporary' | 'account' | 'none'; uses: number };
  'game.temporary-card': { item: Item };
  'game.temporary-card-used': { item: Item };
  'reward.coins-single': { row: number; column: number; amount: number };
  'reward.coins-plural': { row: number; column: number; amount: number };
  'reward.coins-single-one-time': { row: number; column: number; amount: number };
  'reward.coins-plural-one-time': { row: number; column: number; amount: number };
  'reward.item-single': { row: number; column: number; amount: number; item: Item };
  'reward.item-plural': { row: number; column: number; amount: number; item: Item };
  'reward.item-single-one-time': { row: number; column: number; amount: number; item: Item };
  'reward.item-plural-one-time': { row: number; column: number; amount: number; item: Item };
  'status.reward-single': { count: number };
  'status.reward-plural': { count: number };
};
export type SemanticCopyKey = keyof Params;
const ITEM_NAMES = Object.freeze({ lucky: 'shop.item.lucky', detection: 'shop.item.detection',
  revive: 'shop.item.revive', airplane: 'shop.item.airplane' } as const);
const CELL_NAMES = Object.freeze({ unknown: 'game.cell.unknown', flagged: 'game.cell.flagged',
  explored: 'game.cell.explored', obstacle: 'game.cell.obstacle',
  'revealed-mine': 'game.cell.revealed-mine' } as const);
const RESOURCE_NAMES = Object.freeze({ temporary: 'game.item.resource.temporary',
  account: 'game.item.resource.account', none: 'game.item.resource.none' } as const);
const ACCESS_NAMES = Object.freeze({ locked: 'nav.locked', completed: 'nav.completed', available: 'nav.available' } as const);
const invalid = () => presentationCopy('error.technical');
const isCount = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isLevel = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);

/** UI-only formatter; components supply public parameters, never sentence fragments. */
export function semanticCopy<K extends SemanticCopyKey>(key: K, params: Params[K]): string {
  const template = PRESENTATION_TEMPLATES[key];
  if (typeof template !== 'string' || typeof params !== 'object' || params === null) return invalid();
  const values = params as Record<string, unknown>;
  const replacements: Record<string, string> = {};
  for (const [name, value] of Object.entries(values)) {
    if (typeof value === 'number') {
      if (!isCount(value)) return invalid();
      replacements[name] = String(value);
    } else if (name === 'item' && typeof value === 'string' && value in ITEM_NAMES) {
      replacements[name] = presentationCopy(ITEM_NAMES[value as Item]);
    } else if (name === 'appearance' && typeof value === 'string' && value in CELL_NAMES) {
      replacements[name] = presentationCopy(CELL_NAMES[value as Cell]);
    } else if (name === 'resource' && typeof value === 'string' && value in RESOURCE_NAMES) {
      replacements[name] = presentationCopy(RESOURCE_NAMES[value as keyof typeof RESOURCE_NAMES]);
    } else if (name === 'access' && typeof value === 'string' && value in ACCESS_NAMES) {
      replacements[name] = presentationCopy(ACCESS_NAMES[value as keyof typeof ACCESS_NAMES]);
    } else if (name === 'levelId' && isLevel(value)) {
      replacements[name] = value as string;
    } else return invalid();
  }
  let output: string = template;
  for (const name of [...template.matchAll(/\{([A-Za-z]+)\}/g)].map((match) => match[1]!)) {
    if (!(name in replacements)) return invalid();
    output = output.replaceAll(`{${name}}`, replacements[name]!);
  }
  return output.includes('{') || output.includes('}') ? invalid() : output;
}
