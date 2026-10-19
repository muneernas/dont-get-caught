import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import { audioSystem } from '../systems/AudioSystem'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  preload(): void {
    this.cameras.main.setBackgroundColor(COLORS.bgDeep)
    this.load.image('merge_hero', 'assets/merge/menu-hero.jpg')

    const barW = 220
    const cx = GAME.width / 2
    const cy = GAME.height / 2 + 30
    const track = this.add.graphics()
    track.fillStyle(0x000000, 0.3)
    track.fillRoundedRect(cx - barW / 2, cy, barW, 12, 6)
    const fill = this.add.graphics()

    this.add
      .text(cx, cy - 50, 'MERGE HAVEN', {
        fontFamily: FONT.display,
        fontSize: '28px',
        color: '#ffd166',
        fontStyle: '900',
      })
      .setOrigin(0.5)

    this.add
      .text(cx, cy - 16, 'Loading cozy chaos…', {
        fontFamily: FONT.body,
        fontSize: '13px',
        color: '#c4b5e0',
      })
      .setOrigin(0.5)

    this.load.on('progress', (v: number) => {
      fill.clear()
      fill.fillStyle(0xff6b9d, 1)
      fill.fillRoundedRect(cx - barW / 2 + 2, cy + 2, (barW - 4) * v, 8, 4)
    })
  }

  create(): void {
    this.input.once('pointerdown', () => audioSystem.unlock())
    this.time.delayedCall(400, () => {
      this.cameras.main.fadeOut(200, 26, 16, 51)
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'))
    })
  }
}
