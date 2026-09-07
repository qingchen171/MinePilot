const UINT32_MAX = 0xffff_ffff;

export interface RunItemState {
  readonly successfulDetectionUses: number;
  readonly successfulAirplaneUses: number;
  readonly successfulReviveUses: number;
  readonly detectionRandomSeed: number;
}

function requireUseCount(value: number, maximum: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new RangeError(`${name} must be a safe integer between 0 and ${maximum}.`);
  }
}

export function createRunItemState(input: RunItemState): RunItemState {
  requireUseCount(input.successfulDetectionUses, 2, 'Successful Detection uses');
  requireUseCount(input.successfulAirplaneUses, 1, 'Successful Airplane uses');
  requireUseCount(input.successfulReviveUses, 1, 'Successful Revive uses');
  if (
    !Number.isInteger(input.detectionRandomSeed) ||
    input.detectionRandomSeed < 0 ||
    input.detectionRandomSeed > UINT32_MAX
  ) {
    throw new RangeError('Detection random seed must be a non-negative uint32 integer.');
  }

  return Object.freeze({
    successfulDetectionUses: input.successfulDetectionUses,
    successfulAirplaneUses: input.successfulAirplaneUses,
    successfulReviveUses: input.successfulReviveUses,
    detectionRandomSeed: input.detectionRandomSeed,
  });
}

export function createInitialRunItemState(detectionRandomSeed: number): RunItemState {
  return createRunItemState({
    successfulDetectionUses: 0,
    successfulAirplaneUses: 0,
    successfulReviveUses: 0,
    detectionRandomSeed,
  });
}
