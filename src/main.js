import { gameConfig } from './phaser/gameConfig.js';

window.addEventListener('load', () => {
  // global Phaser (CDN) を利用
  // eslint-disable-next-line no-undef
  new Phaser.Game(gameConfig);
});
