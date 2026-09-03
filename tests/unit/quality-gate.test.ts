import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { PROJECT_ROOT, assertProjectWorkingDirectory, isWithinProjectRoot } from '../../scripts/project-root.mjs';
import { QUALITY_STEPS, runQualityGate } from '../../scripts/quality-gate.mjs';

describe('project working-directory guard', () => {
  it('accepts the project root and its descendants', () => {
    expect(isWithinProjectRoot(PROJECT_ROOT)).toBe(true);
    expect(isWithinProjectRoot(path.join(PROJECT_ROOT, 'tests', 'unit'))).toBe(true);
  });

  it('rejects sibling and parent directories', () => {
    expect(isWithinProjectRoot(path.dirname(PROJECT_ROOT))).toBe(false);
    expect(isWithinProjectRoot(`${PROJECT_ROOT}-other`)).toBe(false);
    expect(() => assertProjectWorkingDirectory(path.dirname(PROJECT_ROOT))).toThrow(
      'Refusing to run outside the MinePilot project',
    );
  });
});

describe('unified quality gate', () => {
  it('runs every step in the required order', () => {
    const runStep = vi.fn((_step: string) => 0);

    runQualityGate({ cwd: PROJECT_ROOT, runStep });

    expect(runStep.mock.calls.map(([step]) => step)).toEqual(QUALITY_STEPS);
  });

  it('stops immediately and fails when a step fails', () => {
    const runStep = vi.fn((step: string) => (step === 'test:unit' ? 17 : 0));

    expect(() => runQualityGate({ cwd: PROJECT_ROOT, runStep })).toThrow(
      'Quality gate failed at "test:unit" with exit code 17.',
    );
    expect(runStep.mock.calls.map(([step]) => step)).toEqual(['architecture', 'typecheck', 'test:unit']);
  });

  it('does not start any step when the working directory is unsafe', () => {
    const runStep = vi.fn((_step: string) => 0);

    expect(() => runQualityGate({ cwd: path.dirname(PROJECT_ROOT), runStep })).toThrow(
      'Refusing to run outside the MinePilot project',
    );
    expect(runStep).not.toHaveBeenCalled();
  });
});
