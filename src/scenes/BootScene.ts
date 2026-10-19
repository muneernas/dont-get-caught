import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import { GENERATORS, ITEMS } from '../data/merge/items'
import { audioSystem } from '../systems/AudioSystem'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  preload(): void {
    this.cameras.main.setBackgroundColor(COLORS.bgDeep)

    this.load.image('merge_hero', 'assets/merge/menu-hero.jpg')
    this.load.image('board_bg', 'assets/merge/ui/board-bg.jpg')
    this.load.image('story_map_bg', 'assets/merge/story/map-bg.jpg')
    this.load.image('haven_scene', 'assets/merge/story/scene-wide.jpg')
    this.load.image('gen_tools', 'assets/merge/ui/gen-tools.jpg')
    this.load.image('gen_crops', 'assets/merge/ui/gen-crops.jpg')
    this.load.image('portrait_mira', 'assets/merge/chars/portrait_mira.png')
    this.load.image('portrait_theo', 'assets/merge/chars/portrait_theo.png')
    this.load.image('portrait_lina', 'assets/merge/chars/portrait_lina.png')
    this.load.image('ui_avatar', 'assets/merge/ui/avatar.png')
    for (const item of ITEMS) {
      this.load.image(item.texture, `assets/merge/items/${item.id}.png`)
    }
    void GENERATORS

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
      .text(cx, cy - 16, 'Loading the garden…', {
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
    this.time.delayedCall(350, () => {
      this.cameras.main.fadeOut(200, 26, 16, 51)
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'))
    })
  }
}
