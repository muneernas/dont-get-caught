import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import { LEVEL_BACKGROUNDS } from '../config/assets'
import { getLevel } from '../data/levels'
import { createButton } from '../ui/Button'
import { createNpcView, createPlayerView } from '../ui/Characters'

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

    const bgKey = LEVEL_BACKGROUNDS[level.id] ?? 'bg_classroom'
    const bg = this.add.image(GAME.width / 2, GAME.height / 2, bgKey)
    bg.setDisplaySize(GAME.width, GAME.height)
    bg.setAlpha(0.85)

    const dim = this.add.graphics()
    dim.fillStyle(0x0e1528, 0.55)
    dim.fillRect(0, 0, GAME.width, GAME.height)

    this.add
      .text(GAME.width / 2, 56, level.location.toUpperCase(), {
        fontFamily: FONT.body,
        fontSize: '14px',
        color: '#ffd166',
        stroke: '#0e1528',
        strokeThickness: 3,
      })
      .setOrigin(0.5)

    this.add
      .text(GAME.width / 2, 92, level.title, {
        fontFamily: FONT.display,
        fontSize: '30px',
        color: '#ffffff',
        fontStyle: '900',
        align: 'center',
        wordWrap: { width: 320 },
        stroke: '#0e1528',
        strokeThickness: 4,
      })
      .setOrigin(0.5)

    // Character lineup preview
    const player = createPlayerView(this)
    player.container.setPosition(GAME.width / 2 - 70, 210)
    player.setPose('think')
    level.npcs.slice(0, 3).forEach((npc, i) => {
      const v = createNpcView(this, npc.id, npc.name, npc.color)
      v.container.setPosition(GAME.width / 2 + 40 + i * 18, 210 - i * 4)
      v.setPose(i % 2 === 0 ? 'talk' : 'think')
      v.stateText.setVisible(false)
    })

    const card = this.add.graphics()
    card.fillStyle(0x000000, 0.45)
    card.fillRoundedRect(28, 250, GAME.width - 56, 260, 22)

    this.add.text(48, 272, 'Objective', {
      fontFamily: FONT.display,
      fontSize: '14px',
      color: '#4cc9f0',
      fontStyle: '800',
    })
    this.add.text(48, 296, level.objective, {
      fontFamily: FONT.body,
      fontSize: '15px',
      color: '#ffffff',
      wordWrap: { width: GAME.width - 96 },
    })

    this.add.text(48, 360, 'Watch out', {
      fontFamily: FONT.display,
      fontSize: '14px',
      color: '#ef476f',
      fontStyle: '800',
    })
    this.add.text(48, 384, level.catchHint, {
      fontFamily: FONT.body,
      fontSize: '14px',
      color: '#a8b4c8',
      wordWrap: { width: GAME.width - 96 },
    })

    this.add.text(48, 440, level.blurb, {
      fontFamily: FONT.body,
      fontSize: '13px',
      color: '#ffd166',
      wordWrap: { width: GAME.width - 96 },
    })
    this.add.text(48, 488, 'Hold to act · watch the tell · Safe / Risky / Bold', {
      fontFamily: FONT.body,
      fontSize: '12px',
      color: '#4cc9f0',
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
