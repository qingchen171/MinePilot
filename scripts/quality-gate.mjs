// @ts-check

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { assertProjectWorkingDirectory, PROJECT_ROOT } from './project-root.mjs';

export const QUALITY_STEPS = ['architecture', 'typecheck', 'test:unit', 'build:bundle', 'test:e2e'];

/**
 * @param {string} scriptName
 */
function runNpmScript(scriptName) {
  const npmEntryPoint = process.env.npm_execpath;
  if (!npmEntryPoint) {
    throw new Error('npm_execpath is unavailable. Run the gate through "npm run quality".');
  }

  const result = spawnSync(process.execPath, [npmEntryPoint, 'run', scriptName], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
  });

  if (result.error) {
    throw new Error(`Unable to start quality step "${scriptName}": ${result.error.message}`);
  }

  return result.status ?? 1;
}

/**
 * @param {{ cwd?: string; runStep?: (step: string) => number }} options
 */
export function runQualityGate({ cwd = process.cwd(), runStep = runNpmScript } = {}) {
  assertProjectWorkingDirectory(cwd);

  for (const step of QUALITY_STEPS) {
    const status = runStep(step);
    if (status !== 0) {
      throw new Error(`Quality gate failed at "${step}" with exit code ${status}.`);
    }
  }
}

function runCli() {
  try {
    runQualityGate();
    console.log('MinePilot local quality gate passed.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entryPoint) {
  runCli();
}
