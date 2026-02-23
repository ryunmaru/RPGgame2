import { MAP_HEIGHT, MAP_WIDTH } from './constants.js';
import { BattleScene } from './scenes/BattleScene.js';
import { MapScene } from './scenes/MapScene.js';

export const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: MAP_WIDTH,
  height: MAP_HEIGHT,
  backgroundColor: '#0b1220',
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  },
  scene: [MapScene, BattleScene]
};
