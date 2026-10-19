import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import { audioSystem } from '../systems/AudioSystem'
import { preloadGameArt } from '../ui/Characters'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  preload(): void {
    this.cameras.main.setBackgroundColor(COLORS.bgDeep)

    const barW = 220
    const barH = 12
    const cx = GAME.width / 2
    const cy = GAME.height / 2 + 40
    const track = this.add.graphics()
    track.fillStyle(0x000000, 0.35)
    track.fillRoundedRect(cx - barW / 2, cy - barH / 2, barW, barH, 6)
    const fill = this.add.graphics()

    this.add
      .text(cx, cy - 50, "DON'T GET CAUGHT", {
        fontFamily: FONT.display,
        fontSize: '26px',
        color: '#ffd166',
        fontStyle: '900',
      })
      .setOrigin(0.5)

    this.add
      .text(cx, cy - 18, 'Loading characters…', {
        fontFamily: FONT.body,
        fontSize: '13px',
        color: '#a8b4c8',
      })
      .setOrigin(0.5)

    this.load.on('progress', (value: number) => {
      fill.clear()
      fill.fillStyle(0x06d6a0, 1)
      fill.fillRoundedRect(cx - barW / 2 + 2, cy - barH / 2 + 2, (barW - 4) * value, barH - 4, 4)
    })

    preloadGameArt(this)
  }

  create(): void {
    this.input.once('pointerdown', () => audioSystem.unlock())
    this.cameras.main.fadeOut(220, 14, 21, 40)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Menu')
    })
  }
}
