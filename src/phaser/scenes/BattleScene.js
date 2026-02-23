export class BattleScene extends Phaser.Scene {
  constructor() {
    super('BattleScene');
  }

  create(data) {
    this.cameras.main.setBackgroundColor('#1f1135');

    const enemy = data?.enemy ?? { name: 'なぞのモンスター', level: 1, hp: 10 };

    this.add
      .rectangle(400, 300, 620, 360, 0x3b0764, 0.65)
      .setStrokeStyle(2, 0xc4b5fd, 0.9);

    this.add.text(220, 180, 'BATTLE SCENE', {
      fontFamily: 'monospace',
      fontSize: '42px',
      color: '#f5f3ff'
    });

    this.add.text(210, 250, `Enemy: ${enemy.name}`, {
      fontFamily: 'monospace',
      fontSize: '30px',
      color: '#ede9fe'
    });

    this.add.text(210, 292, `Lv.${enemy.level}  HP ${enemy.hp}`, {
      fontFamily: 'monospace',
      fontSize: '26px',
      color: '#ddd6fe'
    });

    this.add.text(210, 350, 'Mキーでマップに戻る', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ddd6fe'
    });

    this.mapKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.mapKey)) {
      this.scene.start('MapScene');
    }
  }
}
