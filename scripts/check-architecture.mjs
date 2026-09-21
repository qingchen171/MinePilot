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

  if (
    normalize(importerPath) === 'src/core/terminal-settlement.ts' &&
    targetPath === 'src/core/benben-random' &&
    !typeOnly
  ) {
    return 'terminal settlement must not execute Benben RNG';
  }

  if (
    normalize(importerPath) === 'src/core/persistence/save-v3.ts' &&
    (targetPath === 'src/core/benben-random' || targetPath === 'src/core/random')
  ) {
    return 'Save v3 persistence must not depend on gameplay RNG';
  }

  if (
    normalize(importerPath) === 'src/core/reward-generation.ts' &&
    (targetPath === 'src/core/benben-random' || targetPath.startsWith('src/core/persistence/'))
  ) {
    return 'Reward generation must remain independent from Benben RNG and persistence';
  }

  if (
    normalize(importerPath) === 'src/core/level-catalog.ts' &&
    (targetPath === 'src/core/game-state' || targetPath.startsWith('src/core/persistence/'))
  ) {
    return 'Level catalog must remain independent from Runtime and persistence';
  }

  const claimAndItemCompatibilityFiles = new Set([
    'src/core/benben-claim.ts',
    'src/core/item-resource.ts',
    'src/core/lucky.ts',
    'src/core/detection.ts',
    'src/core/airplane.ts',
    'src/core/revive.ts',
  ]);
  if (
    claimAndItemCompatibilityFiles.has(normalize(importerPath)) &&
    targetPath.startsWith('src/core/persistence/')
  ) {
    return 'Claim and Item compatibility must not depend on persistence';
  }

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
    if (relativePath === 'src/main.ts') {
      if (!sourceText.includes('createProductionStage4Session(') ||
          !sourceText.includes('productionSession =')) {
        violations.push(`${relativePath}: production must own one live Stage 4 session`);
      }
      if (/persistence\/(?:lucky|detection|revive|airplane|new-attempt|guarded-persistence)/.test(sourceText)) {
        violations.push(`${relativePath}: obsolete v2 mutation paths must not be reachable`);
      }
    }
    if (relativePath === 'src/systems/persistence/production-stage4-runtime.ts') {
      if (!sourceText.includes('commitCandidateWithWriterLeaseV3') ||
          !sourceText.includes('executeProductionStage4Mutation(storage, identity, clock, intent)') ||
          !sourceText.includes("if (result.status === 'committed')") ||
          !sourceText.includes('authority = {') ||
          /commitCandidateWithWriterLease\(|commitCandidateSaveV2|\.\/(?:lucky|detection|revive|airplane|new-attempt)/.test(sourceText)) {
        violations.push(`${relativePath}: production must use only the guarded v3 commit path`);
      }
    }
    if (relativePath === 'src/systems/persistence/dormant-stage4-mutation.ts' &&
        /commitCandidateWithWriterLease\(|commitCandidateSaveV2|loadPersistedSave\(/.test(sourceText)) {
      violations.push(`${relativePath}: activated composition must not reach the obsolete v2 writer/reader`);
    }
    if (
      relativePath === 'src/core/stage4-attempt-factory.ts' &&
      /(?:systems\/persistence|core\/persistence)/.test(sourceText)
    ) {
      violations.push(`${relativePath}: Complete Attempt factory must not depend on persistence`);
    }
    if (
      relativePath === 'src/core/persistence/stage4-runtime-mapping.ts' &&
      /(?:level-catalog|reward-generation|initial-board|\.\/random)/.test(sourceText)
    ) {
      violations.push(`${relativePath}: reconstruction must not depend on catalog, generation, or RNG`);
    }
    if (
      relativePath === 'src/core/persistence/save-v3.ts' &&
      /\b(?:allowLegacy|migrationSource|legacyTrusted)\b|\btrusted\??\s*:/.test(sourceText)
    ) {
      violations.push(`${relativePath}: migration trust must not use a public boolean or persisted marker`);
    }
    if (
      relativePath === 'src/core/stage4-attempt-factory.ts' &&
      /\b(?:RunIdSource|nextRunId|hiddenSeedSelection|SaveDocumentV3)\b/.test(sourceText)
    ) {
      violations.push(`${relativePath}: Complete Attempt factory must receive exact identity/provenance and return domain truth`);
    }
    if (
      relativePath === 'src/systems/persistence/dormant-stage4-reader.ts' &&
      /(?:persistence-coordinator|guarded-persistence|writer-lease|key-value-storage)/.test(sourceText)
    ) {
      violations.push(`${relativePath}: dormant Stage 4 reader must consume selected authority and remain read-only`);
    }
    if (relativePath === 'src/core/terminal-settlement.ts') {
      if (/\bMath\.random\s*\(/.test(sourceText)) {
        violations.push(`${relativePath}: terminal settlement must not call Math.random`);
      }
      if (/\b3\b/.test(sourceText)) {
        violations.push(`${relativePath}: terminal settlement must not hardcode failuresPerRoll`);
      }
      if (!sourceText.includes('BENBEN_ASSISTANCE_CONFIGURATION.failuresPerRoll')) {
        violations.push(`${relativePath}: terminal settlement must use the Benben config authority`);
      }
    }
    if (relativePath === 'src/core/benben-claim.ts' && /\bMath\.random\s*\(/.test(sourceText)) {
      violations.push(`${relativePath}: Benben Claim must use the deterministic Benben card authority`);
    }
    if (relativePath === 'src/core/reward-generation.ts' && /\bMath\.random\s*\(/.test(sourceText)) {
      violations.push(`${relativePath}: Reward generation must use its deterministic Reward source`);
    }
    if (
      relativePath === 'src/core/level-catalog.ts' &&
      /\b(?:highestUnlocked|currentUnlockedIndex|nextUnlocked)\b/.test(sourceText)
    ) {
      violations.push(`${relativePath}: level access must derive progression without an unlock cache`);
    }
    if (
      (relativePath === 'src/core/level-catalog.ts' || relativePath === 'src/core/reward-generation.ts') &&
      /\b(?:AttemptState|FutureAttempt|Stage4GameState|FutureGameState|RewardManager|LevelManager)\b/.test(sourceText)
    ) {
      violations.push(`${relativePath}: S4-08.1 must not introduce Runtime, Attempt, or manager authority`);
    }
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
