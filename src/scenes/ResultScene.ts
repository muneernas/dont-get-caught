import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import { getLevel, nextLevel } from '../data/levels'
import { economySystem } from '../systems/EconomySystem'
import { saveSystem } from '../systems/SaveSystem'
import { audioSystem } from '../systems/AudioSystem'
import { monetization } from '../monetization/stubs'
import { LEVEL_BACKGROUNDS } from '../config/assets'
import { createButton } from '../ui/Button'
import { addFloatingOrbs } from '../ui/Background'
import { createPlayerView } from '../ui/Characters'
import { formatTime } from '../utils/format'

export class ResultScene extends Phaser.Scene {
  private levelId = 'classroom'
  private success = false
  private timeSeconds = 0
  private peakSuspicion = 0
  private challengeMet = false
  private nearMiss = false
  private recoveredFromHigh = false

  constructor() {
    super('Result')
  }

  init(data: {
    levelId?: string
    success?: boolean
    timeSeconds?: number
    peakSuspicion?: number
    challengeMet?: boolean
    nearMiss?: boolean
    recoveredFromHigh?: boolean
  }): void {
    this.levelId = data.levelId ?? 'classroom'
    this.success = !!data.success
    this.timeSeconds = data.timeSeconds ?? 0
    this.peakSuspicion = data.peakSuspicion ?? 0
    this.challengeMet = !!data.challengeMet
    this.nearMiss = !!data.nearMiss
    this.recoveredFromHigh = !!data.recoveredFromHigh
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
    bg.setAlpha(0.55)
    const dim = this.add.graphics()
    dim.fillStyle(0x0e1528, 0.55)
    dim.fillRect(0, 0, GAME.width, GAME.height)
    addFloatingOrbs(this, this.success ? COLORS.success : COLORS.accentHot, 8)

    const mascot = createPlayerView(this)
    mascot.container.setPosition(GAME.width / 2, 88)
    mascot.setPose(this.success ? 'cheer0' : 'hurt')
    mascot.label.setVisible(false)

    const rewards = economySystem.computeRewards({
      level,
      success: this.success,
      timeSeconds: this.timeSeconds,
      peakSuspicion: this.peakSuspicion,
      challengeMet: this.challengeMet,
      nearMiss: this.nearMiss,
      recoveredFromHigh: this.recoveredFromHigh,
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

    const headline = !this.success
      ? 'CAUGHT!'
      : rewards.nearMissTier === 'too_close'
        ? 'TOO CLOSE!'
        : rewards.nearMissTier === 'close'
          ? 'YOU WERE THIS CLOSE'
          : 'CLEAN GETAWAY'

    const headlineColor =
      !this.success ? '#ef476f' : rewards.nearMissTier !== 'none' ? '#ffd166' : '#06d6a0'

    const title = this.add
      .text(GAME.width / 2, 118, headline, {
        fontFamily: FONT.display,
        fontSize: rewards.nearMissTier !== 'none' && this.success ? '30px' : '36px',
        color: headlineColor,
        fontStyle: '900',
        align: 'center',
        wordWrap: { width: 340 },
      })
      .setOrigin(0.5)
      .setScale(0.6)

    this.tweens.add({ targets: title, scale: 1, duration: 350, ease: 'Back.out' })

    this.add
      .text(
        GAME.width / 2,
        168,
        this.success
          ? rewards.nearMissTier !== 'none'
            ? 'Heart still pounding. One more run?'
            : 'You slipped away. One more?'
          : 'So close. Tap retry — you almost made it.',
        {
          fontFamily: FONT.body,
          fontSize: '14px',
          color: '#a8b4c8',
          align: 'center',
          wordWrap: { width: 300 },
        },
      )
      .setOrigin(0.5)

    if (this.success) {
      const starStr = '★'.repeat(rewards.stars) + '☆'.repeat(3 - rewards.stars)
      this.add
        .text(GAME.width / 2, 210, starStr, {
          fontFamily: FONT.display,
          fontSize: '32px',
          color: '#ffd166',
        })
        .setOrigin(0.5)
      audioSystem.play('star')
    }

    const panel = this.add.graphics()
    panel.fillStyle(0x000000, 0.35)
    panel.fillRoundedRect(32, 255, GAME.width - 64, this.success ? 240 : 160, 18)

    const lines = [
      `Time  ${formatTime(this.timeSeconds)}`,
      `Peak suspicion  ${Math.round(this.peakSuspicion)}%`,
    ]
    if (this.success) {
      lines.push(`Score  ${rewards.score}`)
      lines.push(`Coins  +${rewards.total}`)
      if (rewards.clean) lines.push(`Clean bonus  +${rewards.clean}`)
      if (rewards.nearMiss) lines.push(`Near-miss bonus  +${rewards.nearMiss}`)
      if (rewards.challenge) lines.push(`Challenge  +${rewards.challenge}`)
      if (rewards.streak) lines.push(`Streak  +${rewards.streak}`)
    }
    lines.forEach((line, i) => {
      this.add.text(52, 274 + i * 26, line, {
        fontFamily: FONT.body,
        fontSize: '14px',
        color: '#ffffff',
      })
    })

    const y0 = this.success ? 540 : 470

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
