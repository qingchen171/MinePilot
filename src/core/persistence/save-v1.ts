import {
  createCoordinate,
  type BoardState,
  type CellState,
  type Coordinate,
} from '../board';
import {
  validateBoardInput,
  type BoardValidationIssueCode,
} from '../board-validator';
import {
  createOnBoardPosition,
  createRunState,
  createWaitingPosition,
  type CharacterPosition,
  type MineEncounter,
  type RunPhase,
  type RunState,
} from '../run';

export interface CoordinateSaveV1 {
  readonly x: number;
  readonly y: number;
}

export interface CellSaveV1 {
  readonly terrain: 'playable' | 'obstacle';
  readonly containsMine: boolean;
  readonly explored: boolean;
  readonly mineRevealed: boolean;
  readonly flagged: boolean;
}

export interface BoardSaveV1 {
  readonly dimensions: {
    readonly width: number;
    readonly height: number;
  };
  readonly cells: readonly CellSaveV1[];
}

export type CharacterPositionSaveV1 =
  | { readonly kind: 'waiting' }
  | { readonly kind: 'on-board'; readonly coordinate: CoordinateSaveV1 };

export interface MineEncounterSaveV1 {
  readonly target: CoordinateSaveV1;
  readonly occurredOnFirstStep: boolean;
}

export type RunPhaseSaveV1 =
  | { readonly kind: 'active' }
  | { readonly kind: 'pending-mine-encounter'; readonly encounter: MineEncounterSaveV1 }
  | { readonly kind: 'failed'; readonly encounter: MineEncounterSaveV1 }
  | { readonly kind: 'won' };

export interface GenerationProvenanceSaveV1 {
  readonly seed: number;
  readonly rngVersion: string;
  readonly generationVersion: string;
}

export interface ActiveRunSaveV1 {
  readonly runId: string;
  readonly levelId: string;
  readonly board: BoardSaveV1;
  readonly characterPosition: CharacterPositionSaveV1;
  readonly hasTakenStep: boolean;
  readonly phase: RunPhaseSaveV1;
  readonly generationProvenance?: GenerationProvenanceSaveV1;
}

export interface SaveDocumentV1 {
  readonly saveVersion: 1;
  readonly revision: number;
  readonly activeRun: ActiveRunSaveV1 | null;
}

export interface ActiveRunPersistenceInputV1 {
  readonly runId: string;
  readonly levelId: string;
  readonly run: RunState;
  readonly generationProvenance?: GenerationProvenanceSaveV1;
}

export interface SaveDocumentPersistenceInputV1 {
  readonly revision: number;
  readonly activeRun: ActiveRunPersistenceInputV1 | null;
}

export interface LoadedActiveRunV1 {
  readonly runId: string;
  readonly levelId: string;
  readonly run: RunState;
  readonly generationProvenance?: GenerationProvenanceSaveV1;
}

export type SaveV1ValidationIssueCode =
  | 'invalid-input'
  | 'unknown-field'
  | 'invalid-save-version'
  | 'invalid-revision'
  | 'invalid-active-run'
  | 'invalid-run-id'
  | 'invalid-level-id'
  | 'invalid-board'
  | 'invalid-character-position'
  | 'invalid-coordinate'
  | 'invalid-has-taken-step'
  | 'invalid-phase'
  | 'invalid-encounter'
  | 'invalid-provenance'
  | 'inconsistent-run';

export interface SaveV1ValidationIssue {
  readonly code: SaveV1ValidationIssueCode;
  readonly path: string;
  readonly detail?: BoardValidationIssueCode;
}

export type SerializeSaveDocumentV1Result =
  | { readonly status: 'serialized'; readonly document: SaveDocumentV1 }
  | { readonly status: 'invalid'; readonly issues: readonly SaveV1ValidationIssue[] };

export type ValidateAndLoadSaveDocumentV1Result =
  | {
      readonly status: 'loaded';
      readonly document: SaveDocumentV1;
      readonly activeRun: LoadedActiveRunV1 | null;
    }
  | { readonly status: 'invalid'; readonly issues: readonly SaveV1ValidationIssue[] };

const UINT32_MAX = 0xffff_ffff;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(
  code: SaveV1ValidationIssueCode,
  path: string,
  detail?: BoardValidationIssueCode,
): SaveV1ValidationIssue {
  return detail === undefined ? { code, path } : { code, path, detail };
}

function validateFields(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  path: string,
  missingCode: SaveV1ValidationIssueCode,
): SaveV1ValidationIssue | undefined {
  const allowed = new Set([...required, ...optional]);
  const unknown = Object.keys(value).find((field) => !allowed.has(field));
  if (unknown !== undefined) return issue('unknown-field', `${path}.${unknown}`);
  const missing = required.find((field) => !Object.hasOwn(value, field));
  return missing === undefined ? undefined : issue(missingCode, `${path}.${missing}`);
}

function isNonEmptyId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseCoordinate(
  input: unknown,
  path: string,
): { readonly coordinate: Coordinate } | { readonly validationIssue: SaveV1ValidationIssue } {
  if (!isRecord(input)) return { validationIssue: issue('invalid-coordinate', path) };
  const fieldsIssue = validateFields(input, ['x', 'y'], [], path, 'invalid-coordinate');
  if (fieldsIssue !== undefined) return { validationIssue: fieldsIssue };
  if (typeof input.x !== 'number' || typeof input.y !== 'number') {
    return { validationIssue: issue('invalid-coordinate', path) };
  }
  try {
    return { coordinate: createCoordinate(input.x, input.y) };
  } catch {
    return { validationIssue: issue('invalid-coordinate', path) };
  }
}

function parseCharacterPosition(
  input: unknown,
):
  | { readonly position: CharacterPosition }
  | { readonly validationIssue: SaveV1ValidationIssue } {
  const path = 'activeRun.characterPosition';
  if (!isRecord(input) || typeof input.kind !== 'string') {
    return { validationIssue: issue('invalid-character-position', path) };
  }
  if (input.kind === 'waiting') {
    const fieldsIssue = validateFields(input, ['kind'], [], path, 'invalid-character-position');
    return fieldsIssue === undefined
      ? { position: createWaitingPosition() }
      : { validationIssue: fieldsIssue };
  }
  if (input.kind === 'on-board') {
    const fieldsIssue = validateFields(
      input,
      ['kind', 'coordinate'],
      [],
      path,
      'invalid-character-position',
    );
    if (fieldsIssue !== undefined) return { validationIssue: fieldsIssue };
    const coordinate = parseCoordinate(input.coordinate, `${path}.coordinate`);
    return 'validationIssue' in coordinate
      ? coordinate
      : { position: createOnBoardPosition(coordinate.coordinate) };
  }
  return { validationIssue: issue('invalid-character-position', `${path}.kind`) };
}

function parseEncounter(
  input: unknown,
  path: string,
):
  | { readonly encounter: MineEncounter }
  | { readonly validationIssue: SaveV1ValidationIssue } {
  if (!isRecord(input)) return { validationIssue: issue('invalid-encounter', path) };
  const fieldsIssue = validateFields(
    input,
    ['target', 'occurredOnFirstStep'],
    [],
    path,
    'invalid-encounter',
  );
  if (fieldsIssue !== undefined) return { validationIssue: fieldsIssue };
  if (typeof input.occurredOnFirstStep !== 'boolean') {
    return {
      validationIssue: issue('invalid-encounter', `${path}.occurredOnFirstStep`),
    };
  }
  const target = parseCoordinate(input.target, `${path}.target`);
  return 'validationIssue' in target
    ? target
    : {
        encounter: {
          target: target.coordinate,
          occurredOnFirstStep: input.occurredOnFirstStep,
        },
      };
}

function parsePhase(
  input: unknown,
): { readonly phase: RunPhase } | { readonly validationIssue: SaveV1ValidationIssue } {
  const path = 'activeRun.phase';
  if (!isRecord(input) || typeof input.kind !== 'string') {
    return { validationIssue: issue('invalid-phase', path) };
  }
  if (input.kind === 'active' || input.kind === 'won') {
    const fieldsIssue = validateFields(input, ['kind'], [], path, 'invalid-phase');
    return fieldsIssue === undefined
      ? { phase: { kind: input.kind } }
      : { validationIssue: fieldsIssue };
  }
  if (input.kind === 'pending-mine-encounter' || input.kind === 'failed') {
    const fieldsIssue = validateFields(input, ['kind', 'encounter'], [], path, 'invalid-phase');
    if (fieldsIssue !== undefined) return { validationIssue: fieldsIssue };
    const encounter = parseEncounter(input.encounter, `${path}.encounter`);
    return 'validationIssue' in encounter
      ? encounter
      : { phase: { kind: input.kind, encounter: encounter.encounter } };
  }
  return { validationIssue: issue('invalid-phase', `${path}.kind`) };
}

function parseProvenance(
  input: unknown,
):
  | { readonly provenance: GenerationProvenanceSaveV1 }
  | { readonly validationIssue: SaveV1ValidationIssue } {
  const path = 'activeRun.generationProvenance';
  if (!isRecord(input)) return { validationIssue: issue('invalid-provenance', path) };
  const fieldsIssue = validateFields(
    input,
    ['seed', 'rngVersion', 'generationVersion'],
    [],
    path,
    'invalid-provenance',
  );
  if (fieldsIssue !== undefined) return { validationIssue: fieldsIssue };
  if (
    typeof input.seed !== 'number' ||
    !Number.isInteger(input.seed) ||
    input.seed < 0 ||
    input.seed > UINT32_MAX
  ) {
    return { validationIssue: issue('invalid-provenance', `${path}.seed`) };
  }
  if (!isNonEmptyId(input.rngVersion)) {
    return { validationIssue: issue('invalid-provenance', `${path}.rngVersion`) };
  }
  if (!isNonEmptyId(input.generationVersion)) {
    return {
      validationIssue: issue('invalid-provenance', `${path}.generationVersion`),
    };
  }
  return {
    provenance: {
      seed: input.seed,
      rngVersion: input.rngVersion,
      generationVersion: input.generationVersion,
    },
  };
}

function cellToDto(cell: CellState): CellSaveV1 {
  if (cell.kind === 'obstacle') {
    return {
      terrain: 'obstacle',
      containsMine: false,
      explored: false,
      mineRevealed: false,
      flagged: false,
    };
  }
  if (cell.kind === 'safe') {
    return {
      terrain: 'playable',
      containsMine: false,
      explored: cell.exploration === 'explored',
      mineRevealed: false,
      flagged: cell.flagged,
    };
  }
  return {
    terrain: 'playable',
    containsMine: true,
    explored: false,
    mineRevealed: cell.revelation === 'revealed',
    flagged: cell.flagged,
  };
}

function boardToDto(board: BoardState): BoardSaveV1 {
  return {
    dimensions: { width: board.dimensions.width, height: board.dimensions.height },
    cells: board.cells.map(cellToDto),
  };
}

function coordinateToDto(coordinate: Coordinate): CoordinateSaveV1 {
  return { x: coordinate.x, y: coordinate.y };
}

function positionToDto(position: CharacterPosition): CharacterPositionSaveV1 {
  return position.kind === 'waiting'
    ? { kind: 'waiting' }
    : { kind: 'on-board', coordinate: coordinateToDto(position.coordinate) };
}

function encounterToDto(encounter: MineEncounter): MineEncounterSaveV1 {
  return {
    target: coordinateToDto(encounter.target),
    occurredOnFirstStep: encounter.occurredOnFirstStep,
  };
}

function phaseToDto(phase: RunPhase): RunPhaseSaveV1 {
  return phase.kind === 'active' || phase.kind === 'won'
    ? { kind: phase.kind }
    : { kind: phase.kind, encounter: encounterToDto(phase.encounter) };
}

function activeRunToDto(input: ActiveRunPersistenceInputV1): ActiveRunSaveV1 {
  const base: ActiveRunSaveV1 = {
    runId: input.runId,
    levelId: input.levelId,
    board: boardToDto(input.run.board),
    characterPosition: positionToDto(input.run.characterPosition),
    hasTakenStep: input.run.hasTakenStep,
    phase: phaseToDto(input.run.phase),
  };
  return input.generationProvenance === undefined
    ? base
    : {
        ...base,
        generationProvenance: {
          seed: input.generationProvenance.seed,
          rngVersion: input.generationProvenance.rngVersion,
          generationVersion: input.generationProvenance.generationVersion,
        },
      };
}

function buildDocument(input: SaveDocumentPersistenceInputV1): SaveDocumentV1 {
  return {
    saveVersion: 1,
    revision: input.revision,
    activeRun: input.activeRun === null ? null : activeRunToDto(input.activeRun),
  };
}

function parseBoard(
  input: unknown,
): { readonly board: BoardState } | { readonly issues: readonly SaveV1ValidationIssue[] } {
  const path = 'activeRun.board';
  if (!isRecord(input)) return { issues: [issue('invalid-board', path)] };
  const boardFieldsIssue = validateFields(input, ['dimensions', 'cells'], [], path, 'invalid-board');
  if (boardFieldsIssue !== undefined) return { issues: [boardFieldsIssue] };
  if (!isRecord(input.dimensions) || !Array.isArray(input.cells)) {
    return { issues: [issue('invalid-board', path)] };
  }
  const dimensionsFieldsIssue = validateFields(
    input.dimensions,
    ['width', 'height'],
    [],
    `${path}.dimensions`,
    'invalid-board',
  );
  if (dimensionsFieldsIssue !== undefined) return { issues: [dimensionsFieldsIssue] };

  const mappedCells: unknown[] = [];
  for (const [cellIndex, cell] of input.cells.entries()) {
    if (!isRecord(cell)) {
      mappedCells.push(cell);
      continue;
    }
    const cellPath = `${path}.cells[${cellIndex}]`;
    const cellFieldsIssue = validateFields(
      cell,
      ['terrain', 'containsMine', 'explored', 'mineRevealed', 'flagged'],
      [],
      cellPath,
      'invalid-board',
    );
    if (cellFieldsIssue !== undefined) return { issues: [cellFieldsIssue] };
    mappedCells.push({
      terrain: cell.terrain,
      containsMine: cell.containsMine,
      explored: cell.explored,
      mineRevealed: cell.mineRevealed,
      flagged: cell.flagged,
    });
  }

  const result = validateBoardInput({
    dimensions: { width: input.dimensions.width, height: input.dimensions.height },
    cells: mappedCells,
  });
  return result.status === 'valid'
    ? { board: result.board }
    : {
        issues: result.issues.map((boardIssue) =>
          issue(
            'invalid-board',
            boardIssue.cellIndex === undefined
              ? `${path}${boardIssue.field === undefined ? '' : `.${boardIssue.field}`}`
              : `${path}.cells[${boardIssue.cellIndex}]${
                  boardIssue.field === undefined ? '' : `.${boardIssue.field}`
                }`,
            boardIssue.code,
          ),
        ),
      };
}

function parseActiveRun(
  input: unknown,
):
  | { readonly activeRun: LoadedActiveRunV1 }
  | { readonly issues: readonly SaveV1ValidationIssue[] } {
  const path = 'activeRun';
  if (!isRecord(input)) return { issues: [issue('invalid-active-run', path)] };
  const fieldsIssue = validateFields(
    input,
    ['runId', 'levelId', 'board', 'characterPosition', 'hasTakenStep', 'phase'],
    ['generationProvenance'],
    path,
    'invalid-active-run',
  );
  if (fieldsIssue !== undefined) return { issues: [fieldsIssue] };
  if (!isNonEmptyId(input.runId)) return { issues: [issue('invalid-run-id', `${path}.runId`)] };
  if (!isNonEmptyId(input.levelId)) {
    return { issues: [issue('invalid-level-id', `${path}.levelId`)] };
  }
  if (typeof input.hasTakenStep !== 'boolean') {
    return { issues: [issue('invalid-has-taken-step', `${path}.hasTakenStep`)] };
  }

  const board = parseBoard(input.board);
  if ('issues' in board) return board;
  const position = parseCharacterPosition(input.characterPosition);
  if ('validationIssue' in position) return { issues: [position.validationIssue] };
  const phase = parsePhase(input.phase);
  if ('validationIssue' in phase) return { issues: [phase.validationIssue] };

  let provenance: GenerationProvenanceSaveV1 | undefined;
  if (Object.hasOwn(input, 'generationProvenance')) {
    const parsedProvenance = parseProvenance(input.generationProvenance);
    if ('validationIssue' in parsedProvenance) {
      return { issues: [parsedProvenance.validationIssue] };
    }
    provenance = parsedProvenance.provenance;
  }

  let run: RunState;
  try {
    run = createRunState(board.board, position.position, {
      hasTakenStep: input.hasTakenStep,
      phase: phase.phase,
    });
  } catch {
    return { issues: [issue('inconsistent-run', path)] };
  }

  const activeRun: LoadedActiveRunV1 = {
    runId: input.runId,
    levelId: input.levelId,
    run,
  };
  return provenance === undefined
    ? { activeRun }
    : { activeRun: { ...activeRun, generationProvenance: provenance } };
}

export function validateAndLoadSaveDocumentV1(
  input: unknown,
): ValidateAndLoadSaveDocumentV1Result {
  if (!isRecord(input)) return { status: 'invalid', issues: [issue('invalid-input', '$')] };
  const fieldsIssue = validateFields(
    input,
    ['saveVersion', 'revision', 'activeRun'],
    [],
    '$',
    'invalid-input',
  );
  if (fieldsIssue !== undefined) return { status: 'invalid', issues: [fieldsIssue] };
  if (input.saveVersion !== 1) {
    return { status: 'invalid', issues: [issue('invalid-save-version', '$.saveVersion')] };
  }
  if (
    typeof input.revision !== 'number' ||
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0
  ) {
    return { status: 'invalid', issues: [issue('invalid-revision', '$.revision')] };
  }
  if (input.activeRun === null) {
    return {
      status: 'loaded',
      document: { saveVersion: 1, revision: input.revision, activeRun: null },
      activeRun: null,
    };
  }

  const activeRun = parseActiveRun(input.activeRun);
  if ('issues' in activeRun) return { status: 'invalid', issues: activeRun.issues };
  const document = buildDocument({
    revision: input.revision,
    activeRun: activeRun.activeRun,
  });
  return { status: 'loaded', document, activeRun: activeRun.activeRun };
}

export function serializeSaveDocumentV1(
  input: SaveDocumentPersistenceInputV1,
): SerializeSaveDocumentV1Result {
  const document = buildDocument(input);
  const validation = validateAndLoadSaveDocumentV1(document);
  return validation.status === 'invalid'
    ? validation
    : { status: 'serialized', document: validation.document };
}
