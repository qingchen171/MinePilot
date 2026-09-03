import { describe, expect, it } from 'vitest';
import { layerOf, validateDependency } from '../../scripts/check-architecture.mjs';

describe('architecture boundaries', () => {
  it('keeps core isolated from presentation and orchestration', () => {
    expect(validateDependency('src/core/state.ts', '../scenes/game.ts')).toMatch(/core must not import scenes/);
    expect(validateDependency('src/core/state.ts', './rules.ts')).toBeNull();
    expect(validateDependency('src/core/state.ts', 'phaser')).toMatch(/must not import Phaser/);
  });

  it('allows config and presentation to consume only type-level core contracts', () => {
    expect(validateDependency('src/config/items.ts', '../core/item.ts', true)).toBeNull();
    expect(validateDependency('src/config/items.ts', '../core/item.ts', false)).toMatch(/type-only core/);
    expect(validateDependency('src/ui/hud.ts', '../core/state.ts', true)).toBeNull();
    expect(validateDependency('src/ui/hud.ts', '../systems/run/use-run.ts', true)).toMatch(/ui may import only/);
  });

  it('prevents direct collaboration between system capabilities', () => {
    expect(validateDependency('src/systems/items/use-item.ts', './item-result.ts')).toBeNull();
    expect(validateDependency('src/systems/items/use-item.ts', '../persistence/save.ts')).toMatch(
      /items must not import persistence/,
    );
  });

  it('recognizes bootstrap and planned layer locations', () => {
    expect(layerOf('src/main.ts')).toBe('bootstrap');
    expect(layerOf('src/scenes/game/GameScene.ts')).toBe('scenes');
  });
});
