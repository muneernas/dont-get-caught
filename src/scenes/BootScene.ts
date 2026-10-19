import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import { audioSystem } from '../systems/AudioSystem'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bgDeep)
    const title = this.add
      .text(GAME.width / 2, GAME.height / 2 - 20, "DON'T GET CAUGHT", {
        fontFamily: FONT.display,
        fontSize: '28px',
        color: '#ffd166',
        fontStyle: '900',
      })
      .setOrigin(0.5)
      .setAlpha(0)

    const sub = this.add
      .text(GAME.width / 2, GAME.height / 2 + 20, 'Loading the getaway…', {
        fontFamily: FONT.body,
        fontSize: '14px',
        color: '#a8b4c8',
      })
      .setOrigin(0.5)
      .setAlpha(0)

    this.tweens.add({ targets: [title, sub], alpha: 1, duration: 400 })

    this.input.once('pointerdown', () => audioSystem.unlock())

    this.time.delayedCall(700, () => {
      this.cameras.main.fadeOut(250, 14, 21, 40)
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('Menu')
      })
    })
  }
}
