import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import { LEVELS } from '../data/levels'
import { saveSystem } from '../systems/SaveSystem'
import { audioSystem } from '../systems/AudioSystem'
import { createButton } from '../ui/Button'
import { drawVerticalGradient } from '../ui/Background'

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelect')
  }

  create(): void {
    drawVerticalGradient(this, 0x1a2744, 0x0e1528)
    this.add
      .text(GAME.width / 2, 56, 'LEVELS', {
        fontFamily: FONT.display,
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: '900',
      })
      .setOrigin(0.5)

    createButton(this, {
      x: 48,
      y: 56,
      width: 64,
      height: 40,
      label: '←',
      fill: COLORS.bgPanel,
      fontSize: 22,
      onClick: () => this.scene.start('Menu'),
    })

    LEVELS.forEach((level, i) => {
      const prev = LEVELS[i - 1]
      const unlocked = saveSystem.isUnlocked(level.id, level.order, prev?.id)
      const progress = saveSystem.getLevelProgress(level.id)
      const y = 120 + i * 118

      const g = this.add.graphics()
      g.fillStyle(unlocked ? COLORS.card : 0x1c2436, 1)
      g.fillRoundedRect(24, y, GAME.width - 48, 104, 18)
      g.lineStyle(2, unlocked ? level.accent : COLORS.lock, 0.5)
      g.strokeRoundedRect(24, y, GAME.width - 48, 104, 18)

      this.add.text(44, y + 18, `${level.order}. ${level.location}`, {
        fontFamily: FONT.display,
        fontSize: '18px',
        color: unlocked ? '#ffffff' : '#6b7280',
        fontStyle: '800',
      })
      this.add.text(44, y + 46, unlocked ? level.title : `Locked — ${level.unlockHint}`, {
        fontFamily: FONT.body,
        fontSize: '13px',
        color: unlocked ? '#a8b4c8' : '#5a6578',
        wordWrap: { width: 220 },
      })

      const stars = unlocked
        ? '★'.repeat(progress.stars) + '☆'.repeat(3 - progress.stars)
        : '🔒'
      this.add
        .text(GAME.width - 48, y + 28, stars, {
          fontFamily: FONT.display,
          fontSize: '16px',
          color: '#ffd166',
        })
        .setOrigin(1, 0.5)

      if (unlocked) {
        const hit = this.add
          .rectangle(GAME.width / 2, y + 52, GAME.width - 48, 104, 0x000000, 0.001)
          .setInteractive({ useHandCursor: true })
        hit.on('pointerup', () => {
          audioSystem.play('click')
          this.scene.start('Intro', { levelId: level.id })
        })
      }
    })
  }
}
