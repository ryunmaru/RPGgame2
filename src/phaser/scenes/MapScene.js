import { GRID_SIZE, MAP_HEIGHT, MAP_WIDTH, PLAYER_SPEED, TILE_SIZE } from '../constants.js';

export class MapScene extends Phaser.Scene {
  constructor() {
    super('MapScene');
  }

  create() {
    this.createMapBackground();
    this.createWalls();
    this.createPlayer();
    this.createUi();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.battleKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);

    this.physics.add.collider(this.player, this.walls);

    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.setBackgroundColor('#101a2d');
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.battleKey)) {
      this.scene.start('BattleScene');
      return;
    }

    const body = this.player.body;
    body.setVelocity(0);

    if (this.cursors.left.isDown) {
      body.setVelocityX(-PLAYER_SPEED);
    } else if (this.cursors.right.isDown) {
      body.setVelocityX(PLAYER_SPEED);
    }

    if (this.cursors.up.isDown) {
      body.setVelocityY(-PLAYER_SPEED);
    } else if (this.cursors.down.isDown) {
      body.setVelocityY(PLAYER_SPEED);
    }

    body.velocity.normalize().scale(PLAYER_SPEED);
  }

  createMapBackground() {
    const g = this.add.graphics();
    g.fillStyle(0x1e3a5f, 1);
    g.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    g.lineStyle(1, 0xffffff, 0.08);
    for (let i = 0; i <= GRID_SIZE; i += 1) {
      const p = i * TILE_SIZE;
      g.lineBetween(p, 0, p, MAP_HEIGHT);
      g.lineBetween(0, p, MAP_WIDTH, p);
    }

    g.fillStyle(0x284a72, 1);
    for (let y = 2; y < GRID_SIZE - 2; y += 4) {
      for (let x = 2; x < GRID_SIZE - 2; x += 4) {
        g.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  createWalls() {
    this.walls = this.physics.add.staticGroup();
    const t = TILE_SIZE;

    const edgeSpecs = [
      { x: MAP_WIDTH / 2, y: t / 2, w: MAP_WIDTH, h: t },
      { x: MAP_WIDTH / 2, y: MAP_HEIGHT - t / 2, w: MAP_WIDTH, h: t },
      { x: t / 2, y: MAP_HEIGHT / 2, w: t, h: MAP_HEIGHT },
      { x: MAP_WIDTH - t / 2, y: MAP_HEIGHT / 2, w: t, h: MAP_HEIGHT }
    ];

    edgeSpecs.forEach(({ x, y, w, h }) => {
      const wall = this.add.rectangle(x, y, w, h, 0x0f172a, 0.55);
      this.physics.add.existing(wall, true);
      this.walls.add(wall);
    });
  }

  createPlayer() {
    this.player = this.add.rectangle(TILE_SIZE * 2, TILE_SIZE * 2, TILE_SIZE * 0.7, TILE_SIZE * 0.7, 0xfbbf24);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.player.body.setSize(TILE_SIZE * 0.7, TILE_SIZE * 0.7);
  }

  createUi() {
    this.add
      .text(14, 12, 'MAP SCENE\n矢印キー: 移動\nBキー: バトルへ', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#f8fafc',
        backgroundColor: '#0f172acc',
        padding: { x: 10, y: 8 }
      })
      .setScrollFactor(0)
      .setDepth(50);
  }
}
