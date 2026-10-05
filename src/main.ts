import Phaser from 'phaser';
import { BASELINE_MESSAGE } from './baseline';
import { presentationCopy } from './config/presentation-copy';
import { createPresentationRoot } from './presentation-root';
import { createLocalStorageAdapter } from './systems/persistence/key-value-storage';
import { createProductionStage4Session } from './systems/persistence/production-stage4-runtime';
import { createSystemClock, createWriterIdentity } from './systems/persistence/writer-lease';
import { createSecureTechnicalFacts } from './systems/presentation/technical-facts';
import './style.css';

let browserStorage: Storage | null = null;
try { browserStorage = window.localStorage; } catch { /* The adapter reports unavailable storage. */ }
/** One browser authority; failed secure identity prevents boot without touching saved data. */
export const presentationRoot = (() => {
  try {
    const productionSession = createProductionStage4Session(
      createLocalStorageAdapter(browserStorage), createWriterIdentity(), createSystemClock(),
    );
    return createPresentationRoot(productionSession, createSecureTechnicalFacts({
      newGameplayRunId: () => globalThis.crypto.randomUUID(),
      newGenerationUint32: () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0],
      newDetectionUint32: () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0],
    }));
  } catch {
    return null;
  }
})();

// HMR must reload before replacing the composition root, never create a second live session.
import.meta.hot?.on('vite:beforeUpdate', () => window.location.reload());

class BaselineScene extends Phaser.Scene {
  constructor() {
    super('BaselineScene');
  }

  create(): void {
    this.add
      .text(320, 180, BASELINE_MESSAGE, {
        color: '#18324a',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
      })
      .setOrigin(0.5);
  }
}

const status = document.querySelector<HTMLElement>('#status');

new Phaser.Game({
  type: Phaser.AUTO,
  width: 640,
  height: 360,
  backgroundColor: '#dff3ff',
  parent: 'game',
  scene: BaselineScene,
  callbacks: {
    postBoot: () => {
      document.documentElement.dataset.phaserReady = 'true';
      document.documentElement.dataset.phaserVersion = Phaser.VERSION;
      if (status) {
        status.textContent = presentationRoot === null
          ? presentationCopy('status.unavailable') : BASELINE_MESSAGE;
      }
    },
  },
});
