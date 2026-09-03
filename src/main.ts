import Phaser from 'phaser';
import { BASELINE_MESSAGE } from './baseline';
import './style.css';

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
