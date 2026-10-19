import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import { LEVELS } from '../data/levels'
import { saveSystem } from '../systems/SaveSystem'
import { audioSystem } from '../systems/AudioSystem'
import { createButton } from '../ui/Button'
import { addFloatingOrbs, drawVerticalGradient } from '../ui/Background'

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu')
  }

  create(): void {
    audioSystem.unlock()
    drawVerticalGradient(this, 0x1a2744, 0x0e1528)
    addFloatingOrbs(this, COLORS.accent, 10)
    addFloatingOrbs(this, COLORS.info, 6)

    const eye = this.add.circle(GAME.width / 2, 168, 54, COLORS.gold, 1)
    this.add.circle(GAME.width / 2 - 16, 160, 8, COLORS.bgDeep)
    this.add.circle(GAME.width / 2 + 16, 160, 8, COLORS.bgDeep)
    const mouth = this.add.graphics()
    mouth.lineStyle(4, COLORS.accentHot, 1)
    mouth.beginPath()
    mouth.arc(GAME.width / 2, 178, 18, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160))
    mouth.strokePath()
    this.tweens.add({
      targets: eye,
      scaleX: 1.05,
      scaleY: 0.92,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    this.add
      .text(GAME.width / 2, 250, "DON'T GET CAUGHT", {
        fontFamily: FONT.display,
        fontSize: '34px',
        color: '#ffffff',
        fontStyle: '900',
        align: 'center',
      })
      .setOrigin(0.5)

    this.add
      .text(GAME.width / 2, 292, 'How long can you stay unnoticed?', {
        fontFamily: FONT.body,
        fontSize: '15px',
        color: '#a8b4c8',
      })
      .setOrigin(0.5)

    const save = saveSystem.snapshot
    const current = LEVELS.find((l) => l.id === save.currentLevelId) ?? LEVELS[0]!

    this.add
      .text(
        GAME.width / 2,
        340,
        `Lv ${current.order} ${current.location}  ·  ${save.coins}🪙  ·  🔥${save.streak}`,
        {
          fontFamily: FONT.body,
          fontSize: '13px',
          color: '#ffd166',
        },
      )
      .setOrigin(0.5)

    this.add
      .text(GAME.width / 2, 362, `Best score ${save.bestScore}`, {
        fontFamily: FONT.body,
        fontSize: '12px',
        color: '#4cc9f0',
      })
      .setOrigin(0.5)

    createButton(this, {
      x: GAME.width / 2,
      y: 430,
      width: 280,
      height: 56,
      label: 'PLAY',
      fill: COLORS.accent,
      onClick: () => this.scene.start('Intro', { levelId: current.id }),
    })
    createButton(this, {
      x: GAME.width / 2,
      y: 500,
      width: 280,
      height: 50,
      label: 'LEVELS',
      fill: COLORS.info,
      onClick: () => this.scene.start('LevelSelect'),
    })
    createButton(this, {
      x: GAME.width / 2,
      y: 562,
      width: 280,
      height: 50,
      label: 'SHOP',
      fill: 0xc9a227,
      onClick: () => this.scene.start('Shop'),
    })
    createButton(this, {
      x: GAME.width / 2,
      y: 624,
      width: 280,
      height: 50,
      label: 'SETTINGS',
      fill: COLORS.bgPanel,
      onClick: () => this.scene.start('Settings'),
    })

    const daily = LEVELS[0]!
    const panel = this.add.graphics()
    panel.fillStyle(COLORS.bgPanel, 0.9)
    panel.fillRoundedRect(28, 690, GAME.width - 56, 100, 18)
    this.add.text(48, 710, 'Daily Challenge', {
      fontFamily: FONT.display,
      fontSize: '16px',
      color: '#ffd166',
      fontStyle: '800',
    })
    this.add.text(48, 736, daily.dailyChallengeText ?? daily.rewards.challenge, {
      fontFamily: FONT.body,
      fontSize: '13px',
      color: '#ffffff',
      wordWrap: { width: GAME.width - 100 },
    })
  }
}
