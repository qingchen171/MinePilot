// @ts-check

import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {string} workingDirectory
 * @param {string} projectRoot
 */
export function isWithinProjectRoot(workingDirectory, projectRoot = PROJECT_ROOT) {
  const relativePath = path.relative(path.resolve(projectRoot), path.resolve(workingDirectory));

  return (
    relativePath === '' ||
    (!relativePath.startsWith(`..${path.sep}`) && relativePath !== '..' && !path.isAbsolute(relativePath))
  );
}

/**
 * @param {string} workingDirectory
 * @param {string} projectRoot
 */
export function assertProjectWorkingDirectory(workingDirectory, projectRoot = PROJECT_ROOT) {
  if (!isWithinProjectRoot(workingDirectory, projectRoot)) {
    throw new Error(
      `Refusing to run outside the MinePilot project. Expected ${projectRoot}; received ${path.resolve(workingDirectory)}.`,
    );
  }
}
