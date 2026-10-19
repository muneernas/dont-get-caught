import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import { getLevel } from '../data/levels'
import { createButton } from '../ui/Button'
import { drawVerticalGradient, addFloatingOrbs } from '../ui/Background'

export class IntroScene extends Phaser.Scene {
  private levelId = 'classroom'

  constructor() {
    super('Intro')
  }

  init(data: { levelId?: string }): void {
    this.levelId = data.levelId ?? 'classroom'
  }

  create(): void {
    const level = getLevel(this.levelId)
    if (!level) {
      this.scene.start('Menu')
      return
    }

    drawVerticalGradient(this, level.bgTop, level.bgBottom)
    addFloatingOrbs(this, level.accent, 8)

    this.add
      .text(GAME.width / 2, 120, level.location.toUpperCase(), {
        fontFamily: FONT.body,
        fontSize: '14px',
        color: '#ffd166',
      })
      .setOrigin(0.5)

    this.add
      .text(GAME.width / 2, 160, level.title, {
        fontFamily: FONT.display,
        fontSize: '32px',
        color: '#ffffff',
        fontStyle: '900',
        align: 'center',
        wordWrap: { width: 320 },
      })
      .setOrigin(0.5)

    const card = this.add.graphics()
    card.fillStyle(0x000000, 0.35)
    card.fillRoundedRect(28, 230, GAME.width - 56, 280, 22)

    this.add.text(48, 255, 'Objective', {
      fontFamily: FONT.display,
      fontSize: '14px',
      color: '#4cc9f0',
      fontStyle: '800',
    })
    this.add.text(48, 280, level.objective, {
      fontFamily: FONT.body,
      fontSize: '16px',
      color: '#ffffff',
      wordWrap: { width: GAME.width - 96 },
    })

    this.add.text(48, 360, 'Watch out', {
      fontFamily: FONT.display,
      fontSize: '14px',
      color: '#ef476f',
      fontStyle: '800',
    })
    this.add.text(48, 385, level.catchHint, {
      fontFamily: FONT.body,
      fontSize: '15px',
      color: '#a8b4c8',
      wordWrap: { width: GAME.width - 96 },
    })

    this.add.text(48, 450, level.blurb, {
      fontFamily: FONT.body,
      fontSize: '14px',
      color: '#ffd166',
      wordWrap: { width: GAME.width - 96 },
    })

    createButton(this, {
      x: GAME.width / 2,
      y: 580,
      width: 260,
      height: 56,
      label: 'START',
      fill: COLORS.success,
      onClick: () => this.scene.start('Game', { levelId: level.id }),
    })
    createButton(this, {
      x: GAME.width / 2,
      y: 650,
      width: 200,
      height: 44,
      label: 'Back',
      fill: COLORS.bgPanel,
      fontSize: 18,
      onClick: () => this.scene.start('LevelSelect'),
    })
  }
}
