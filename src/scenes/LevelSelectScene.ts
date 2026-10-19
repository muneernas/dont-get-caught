import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import { LEVEL_BACKGROUNDS } from '../config/assets'
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
      const y = 110 + i * 128

      const g = this.add.graphics()
      g.fillStyle(unlocked ? COLORS.card : 0x1c2436, 1)
      g.fillRoundedRect(24, y, GAME.width - 48, 114, 18)
      g.lineStyle(2, unlocked ? level.accent : COLORS.lock, 0.55)
      g.strokeRoundedRect(24, y, GAME.width - 48, 114, 18)

      const bgKey = LEVEL_BACKGROUNDS[level.id]
      if (bgKey && this.textures.exists(bgKey)) {
        const thumb = this.add.image(68, y + 57, bgKey)
        thumb.setDisplaySize(72, 72)
        thumb.setAlpha(unlocked ? 0.95 : 0.35)
        const frame = this.add.graphics()
        frame.lineStyle(2, unlocked ? level.accent : COLORS.lock, 0.7)
        frame.strokeRoundedRect(32, y + 21, 72, 72, 12)
      }

      this.add.text(118, y + 22, `${level.order}. ${level.location}`, {
        fontFamily: FONT.display,
        fontSize: '17px',
        color: unlocked ? '#ffffff' : '#6b7280',
        fontStyle: '800',
      })
      this.add.text(118, y + 48, unlocked ? level.title : `Locked — ${level.unlockHint}`, {
        fontFamily: FONT.body,
        fontSize: '12px',
        color: unlocked ? '#a8b4c8' : '#5a6578',
        wordWrap: { width: 180 },
      })

      const stars = unlocked
        ? '★'.repeat(progress.stars) + '☆'.repeat(3 - progress.stars)
        : '🔒'
      this.add
        .text(GAME.width - 48, y + 34, stars, {
          fontFamily: FONT.display,
          fontSize: '15px',
          color: '#ffd166',
        })
        .setOrigin(1, 0.5)

      if (unlocked) {
        const hit = this.add
          .rectangle(GAME.width / 2, y + 57, GAME.width - 48, 114, 0x000000, 0.001)
          .setInteractive({ useHandCursor: true })
        hit.on('pointerup', () => {
          audioSystem.play('click')
          this.scene.start('Intro', { levelId: level.id })
        })
      }
    })
  }
}
