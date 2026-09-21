import Phaser from 'phaser';
import { BASELINE_MESSAGE } from './baseline';
import { createLocalStorageAdapter } from './systems/persistence/key-value-storage';
import { createProductionStage4Session } from './systems/persistence/production-stage4-runtime';
import { createSystemClock, createWriterIdentity } from './systems/persistence/writer-lease';
import './style.css';

let browserStorage: Storage | null = null;
try { browserStorage = window.localStorage; } catch { /* The adapter reports unavailable storage. */ }
/** One browser authority: read-only on boot, guarded v3 commit before any mutation is published. */
export const productionSession = createProductionStage4Session(
  createLocalStorageAdapter(browserStorage), createWriterIdentity(), createSystemClock(),
);

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
        status.textContent = BASELINE_MESSAGE;
      }
    },
  },
});
