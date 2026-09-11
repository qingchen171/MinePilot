export function isStableId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function createStableId(value: unknown, name: string): string {
  if (!isStableId(value)) throw new Error(`${name} must be a nonblank string.`);
  return value;
}
