import type { Coordinate } from '../../core/board';
import type { Stage4GameState } from '../../core/stage4-game-state';
import type { ShopItem } from '../../core/shop';

/** Presentation-owned structural port; bootstrap alone adapts the production session. */
export interface CreationFacts {
  readonly runId: string;
  readonly baseSeed: number;
  readonly rngVersion: string;
  readonly generationVersion: string;
}

type Authority = { readonly expectedRevision: number | null; readonly expectedRunId: string | null };
export type SessionIntent = Authority & (
  | { readonly kind: 'start'; readonly levelId: string; readonly creation: CreationFacts }
  | { readonly kind: 'restart' | 'retry' | 'replay' | 'next'; readonly creation: CreationFacts }
  | { readonly kind: 'abandon' | 'dismiss' | 'failure' | 'revive' | 'claim-benben' }
  | { readonly kind: 'flag'; readonly coordinate: Coordinate; readonly flagged: boolean }
  | { readonly kind: 'move' | 'airplane'; readonly coordinate: Coordinate }
  | { readonly kind: 'detection'; readonly initializeSeed?: number }
  | { readonly kind: 'purchase'; readonly item: unknown }
  | { readonly kind: 'set-setting'; readonly key: unknown; readonly enabled: unknown }
  | { readonly kind: 'acknowledge-tutorial'; readonly milestoneId: unknown }
);

export type SessionRead =
  | { readonly status: 'fresh'; readonly runtime: Stage4GameState; readonly persistence: { readonly kind: 'no-save' } }
  | { readonly status: 'loaded'; readonly runtime: Stage4GameState; readonly persistence: {
      readonly kind: 'committed'; readonly revision: number; readonly source: 'head' | 'head-backup';
      readonly sourceSaveVersion: 1 | 2 | 3 | 4;
    } }
  | { readonly status: 'invalid-json' | 'invalid-save' | 'revision-mismatch' | 'unavailable-snapshot' };

export type SessionMutationResult =
  | { readonly status: 'committed'; readonly revision: number; readonly runtime: Stage4GameState }
  | { readonly status: 'rejected'; readonly reason: string };

export interface PresentationSessionPort {
  read(): SessionRead;
  reload(): SessionRead;
  execute(intent: SessionIntent): SessionMutationResult;
}

export type SemanticIntent =
  | { readonly kind: 'start'; readonly levelId: string }
  | { readonly kind: 'restart' | 'retry' | 'replay' | 'next' | 'abandon' | 'dismiss' | 'failure' | 'revive' | 'claim-benben' }
  | { readonly kind: 'flag'; readonly coordinate: Coordinate; readonly flagged: boolean }
  | { readonly kind: 'move' | 'airplane'; readonly coordinate: Coordinate }
  | { readonly kind: 'detection' }
  | { readonly kind: 'purchase'; readonly item: ShopItem }
  | { readonly kind: 'set-setting'; readonly key: 'musicEnabled' | 'soundEffectsEnabled'; readonly enabled: boolean }
  | { readonly kind: 'acknowledge-tutorial'; readonly milestoneId: string };

export interface TechnicalFactsSource {
  nextRunId(): string;
  nextGenerationSeed(): number;
  nextDetectionSeed(): number;
}
