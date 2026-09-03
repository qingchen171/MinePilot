// @ts-check

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertProjectWorkingDirectory, PROJECT_ROOT } from './project-root.mjs';

const SOURCE_ROOT = path.join(PROJECT_ROOT, 'src');
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx']);
const LAYERS = new Set(['assets', 'audio', 'config', 'core', 'scenes', 'systems', 'ui']);

/** @param {string} value */
function normalize(value) {
  return value.replaceAll('\\', '/');
}

/** @param {string} relativePath */
export function layerOf(relativePath) {
  const parts = normalize(relativePath).split('/');
  return parts[0] === 'src' && LAYERS.has(parts[1]) ? parts[1] : 'bootstrap';
}

/** @param {string} relativePath */
function systemCapability(relativePath) {
  const parts = normalize(relativePath).split('/');
  return parts[0] === 'src' && parts[1] === 'systems' ? parts[2] ?? null : null;
}

/**
 * @param {string} importerPath project-relative path
 * @param {string} specifier import specifier
 * @param {boolean} typeOnly whether the complete import/export is type-only
 * @returns {string | null}
 */
export function validateDependency(importerPath, specifier, typeOnly = false) {
  const sourceLayer = layerOf(importerPath);

  if (!specifier.startsWith('.')) {
    if (specifier === 'phaser' && sourceLayer !== 'bootstrap' && sourceLayer !== 'scenes') {
      return `${sourceLayer} must not import Phaser`;
    }
    return null;
  }

  const importerDirectory = path.posix.dirname(normalize(importerPath));
  const targetPath = path.posix.normalize(path.posix.join(importerDirectory, specifier));
  const targetLayer = layerOf(targetPath);

  if (sourceLayer === 'bootstrap') return null;
  if (sourceLayer === 'assets') return 'assets must not contain executable source';

  if (sourceLayer === 'core') {
    return targetLayer === 'core' ? null : `core must not import ${targetLayer}`;
  }

  if (sourceLayer === 'config') {
    if (targetLayer === 'config' || (targetLayer === 'core' && typeOnly)) return null;
    return `config may import only config or type-only core, not ${targetLayer}`;
  }

  if (sourceLayer === 'systems') {
    if (targetLayer === 'core' || targetLayer === 'config') return null;
    if (targetLayer === 'systems') {
      const sourceCapability = systemCapability(importerPath);
      const targetCapability = systemCapability(targetPath);
      return sourceCapability && sourceCapability === targetCapability
        ? null
        : `systems capability ${sourceCapability ?? '(root)'} must not import ${targetCapability ?? '(root)'}`;
    }
    return `systems must not import ${targetLayer}`;
  }

  if (sourceLayer === 'scenes') {
    return new Set(['assets', 'audio', 'config', 'core', 'scenes', 'systems', 'ui']).has(targetLayer)
      ? null
      : `scenes must not import ${targetLayer}`;
  }

  if (sourceLayer === 'ui' || sourceLayer === 'audio') {
    if (targetLayer === sourceLayer || targetLayer === 'assets' || targetLayer === 'config') return null;
    if (targetLayer === 'core' && typeOnly) return null;
    return `${sourceLayer} may import only its own layer, assets, config, or type-only core, not ${targetLayer}`;
  }

  return null;
}

/**
 * @param {string} directory
 * @returns {string[]}
 */
function collectSourceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [entryPath] : [];
  });
}

/** @returns {string[]} */
export function checkArchitecture() {
  /** @type {string[]} */
  const violations = [];

  for (const absolutePath of collectSourceFiles(SOURCE_ROOT)) {
    const relativePath = normalize(path.relative(PROJECT_ROOT, absolutePath));
    if (layerOf(relativePath) === 'assets') {
      violations.push(`${relativePath}: assets must not contain executable source`);
      continue;
    }

    const sourceText = fs.readFileSync(absolutePath, 'utf8');
    const dependencyPattern = /(?:^|\n)\s*(import|export)\s+(type\s+)?(?:[^'"\n;]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    for (const match of sourceText.matchAll(dependencyPattern)) {
      const specifier = match[3] ?? match[4];
      const typeOnly = Boolean(match[2]) && Boolean(match[3]);
      const problem = validateDependency(relativePath, specifier, typeOnly);
      if (problem) {
        const line = sourceText.slice(0, match.index).split('\n').length;
        violations.push(`${relativePath}:${line}: ${problem}`);
      }
    }
  }

  return violations;
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  assertProjectWorkingDirectory('architecture check');
  const violations = checkArchitecture();
  if (violations.length > 0) {
    console.error('Architecture boundary check failed:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
  } else {
    console.log('Architecture boundary check passed.');
  }
}
