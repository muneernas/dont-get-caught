import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import { getLevel, nextLevel } from '../data/levels'
import { economySystem } from '../systems/EconomySystem'
import { saveSystem } from '../systems/SaveSystem'
import { audioSystem } from '../systems/AudioSystem'
import { monetization } from '../monetization/stubs'
import { createButton } from '../ui/Button'
import { drawVerticalGradient, addFloatingOrbs } from '../ui/Background'
import { formatTime } from '../utils/format'

export class ResultScene extends Phaser.Scene {
  private levelId = 'classroom'
  private success = false
  private timeSeconds = 0
  private peakSuspicion = 0
  private challengeMet = false

  constructor() {
    super('Result')
  }

  init(data: {
    levelId?: string
    success?: boolean
    timeSeconds?: number
    peakSuspicion?: number
    challengeMet?: boolean
  }): void {
    this.levelId = data.levelId ?? 'classroom'
    this.success = !!data.success
    this.timeSeconds = data.timeSeconds ?? 0
    this.peakSuspicion = data.peakSuspicion ?? 0
    this.challengeMet = !!data.challengeMet
  }

  create(): void {
    const level = getLevel(this.levelId)
    if (!level) {
      this.scene.start('Menu')
      return
    }

    drawVerticalGradient(this, level.bgTop, level.bgBottom)
    addFloatingOrbs(this, this.success ? COLORS.success : COLORS.accentHot, 10)

    const rewards = economySystem.computeRewards({
      level,
      success: this.success,
      timeSeconds: this.timeSeconds,
      peakSuspicion: this.peakSuspicion,
      challengeMet: this.challengeMet,
    })

    if (this.success) {
      saveSystem.recordClear({
        levelId: level.id,
        stars: rewards.stars,
        timeSeconds: this.timeSeconds,
        score: rewards.score,
        clean: this.peakSuspicion < 40,
        coinsEarned: rewards.total,
      })
      audioSystem.play('coins')
    }

    this.add
      .text(GAME.width / 2, 120, this.success ? 'CLEAN GETAWAY' : 'CAUGHT!', {
        fontFamily: FONT.display,
        fontSize: '36px',
        color: this.success ? '#06d6a0' : '#ef476f',
        fontStyle: '900',
      })
      .setOrigin(0.5)
      .setScale(0.6)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      scale: 1,
      duration: 350,
      ease: 'Back.out',
    })

    this.add
      .text(
        GAME.width / 2,
        170,
        this.success
          ? 'You slipped away. One more?'
          : 'So close. Tap retry — you almost made it.',
        {
          fontFamily: FONT.body,
          fontSize: '15px',
          color: '#a8b4c8',
          align: 'center',
          wordWrap: { width: 300 },
        },
      )
      .setOrigin(0.5)

    if (this.success) {
      const starStr = '★'.repeat(rewards.stars) + '☆'.repeat(3 - rewards.stars)
      this.add
        .text(GAME.width / 2, 220, starStr, {
          fontFamily: FONT.display,
          fontSize: '34px',
          color: '#ffd166',
        })
        .setOrigin(0.5)
      audioSystem.play('star')
    }

    const panel = this.add.graphics()
    panel.fillStyle(0x000000, 0.35)
    panel.fillRoundedRect(32, 270, GAME.width - 64, this.success ? 220 : 160, 18)

    const lines = [
      `Time  ${formatTime(this.timeSeconds)}`,
      `Peak suspicion  ${Math.round(this.peakSuspicion)}%`,
    ]
    if (this.success) {
      lines.push(`Score  ${rewards.score}`)
      lines.push(`Coins  +${rewards.total}`)
      if (rewards.clean) lines.push(`Clean bonus  +${rewards.clean}`)
      if (rewards.challenge) lines.push(`Challenge  +${rewards.challenge}`)
      if (rewards.streak) lines.push(`Streak  +${rewards.streak}`)
    }
    lines.forEach((line, i) => {
      this.add.text(52, 290 + i * 28, line, {
        fontFamily: FONT.body,
        fontSize: '15px',
        color: '#ffffff',
      })
    })

    const y0 = this.success ? 540 : 480

    createButton(this, {
      x: GAME.width / 2,
      y: y0,
      width: 260,
      height: 54,
      label: this.success ? 'NEXT LEVEL' : 'TRY AGAIN',
      fill: this.success ? COLORS.success : COLORS.accent,
      onClick: () => {
        if (this.success) {
          const n = nextLevel(level.id)
          if (n) this.scene.start('Intro', { levelId: n.id })
          else this.scene.start('LevelSelect')
        } else {
          this.scene.start('Game', { levelId: level.id })
        }
      },
    })

    if (!this.success) {
      createButton(this, {
        x: GAME.width / 2,
        y: y0 + 70,
        width: 260,
        height: 48,
        label: 'Ad: −25% Suspicion',
        fill: COLORS.info,
        fontSize: 16,
        onClick: async () => {
          const res = await monetization.showRewardedAd('reduce_suspicion')
          if (res.watched) {
            // Soft continue: restart with a head-start boost token feel
            saveSystem.addBoost('suspicionShield', 1)
            this.scene.start('Game', { levelId: level.id })
          }
        },
      })
    }

    createButton(this, {
      x: GAME.width / 2,
      y: y0 + (this.success ? 70 : 140),
      width: 200,
      height: 44,
      label: 'Levels',
      fill: COLORS.bgPanel,
      fontSize: 18,
      onClick: () => this.scene.start('LevelSelect'),
    })

    createButton(this, {
      x: GAME.width / 2,
      y: y0 + (this.success ? 130 : 200),
      width: 200,
      height: 44,
      label: 'Menu',
      fill: COLORS.bgPanel,
      fontSize: 18,
      onClick: () => this.scene.start('Menu'),
    })
  }
}
