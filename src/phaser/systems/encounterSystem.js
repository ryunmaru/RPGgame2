import { TILE_SIZE } from '../constants.js';

const ENCOUNTER_RATE = 0.1;

const ENEMIES = [
  { id: 'slime', name: 'スライム', level: 3, hp: 28 },
  { id: 'bat', name: 'ダークバット', level: 4, hp: 32 },
  { id: 'wolf', name: 'ワイルドウルフ', level: 5, hp: 38 },
  { id: 'golem', name: 'ストーンゴーレム', level: 6, hp: 45 }
];

export class EncounterSystem {
  getTilePosition(worldX, worldY) {
    return {
      x: Math.floor(worldX / TILE_SIZE),
      y: Math.floor(worldY / TILE_SIZE)
    };
  }

  shouldTriggerEncounter() {
    return Math.random() < ENCOUNTER_RATE;
  }

  getRandomEnemy() {
    const index = Math.floor(Math.random() * ENEMIES.length);
    return ENEMIES[index];
  }

  resolveEncounter(previousTile, currentTile) {
    if (!previousTile) {
      return null;
    }

    const movedTile = previousTile.x !== currentTile.x || previousTile.y !== currentTile.y;
    if (!movedTile) {
      return null;
    }

    if (!this.shouldTriggerEncounter()) {
      return null;
    }

    return this.getRandomEnemy();
  }
}
