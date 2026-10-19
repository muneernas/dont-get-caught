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
    addFloatingOrbs(this, COLORS.accent, 8)
    addFloatingOrbs(this, COLORS.info, 5)

    const glow = this.add.circle(GAME.width / 2, 150, 120, 0xffd166, 0.14)
    this.tweens.add({
      targets: glow,
      scale: 1.1,
      alpha: 0.2,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    if (this.textures.exists('menu_hero')) {
      const hero = this.add.image(GAME.width / 2, 148, 'menu_hero')
      hero.setDisplaySize(210, 210)
      this.add.circle(GAME.width / 2, 148, 108, 0x000000, 0).setStrokeStyle(5, 0xffd166, 0.45)
      this.tweens.add({
        targets: hero,
        y: hero.y - 4,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    this.add
      .text(GAME.width / 2, 278, "DON'T GET CAUGHT", {
        fontFamily: FONT.display,
        fontSize: '32px',
        color: '#ffffff',
        fontStyle: '900',
        align: 'center',
        stroke: '#0e1528',
        strokeThickness: 5,
      })
      .setOrigin(0.5)

    this.add
      .text(GAME.width / 2, 316, 'How long can you stay unnoticed?', {
        fontFamily: FONT.body,
        fontSize: '14px',
        color: '#a8b4c8',
      })
      .setOrigin(0.5)

    const save = saveSystem.snapshot
    const current = LEVELS.find((l) => l.id === save.currentLevelId) ?? LEVELS[0]!

    this.add
      .text(
        GAME.width / 2,
        348,
        `Lv ${current.order} ${current.location}  ·  ${save.coins} coins  ·  streak ${save.streak}`,
        {
          fontFamily: FONT.body,
          fontSize: '12px',
          color: '#ffd166',
        },
      )
      .setOrigin(0.5)

    this.add
      .text(GAME.width / 2, 366, `Best score ${save.bestScore}`, {
        fontFamily: FONT.body,
        fontSize: '12px',
        color: '#4cc9f0',
      })
      .setOrigin(0.5)

    createButton(this, {
      x: GAME.width / 2,
      y: 428,
      width: 280,
      height: 56,
      label: 'PLAY',
      fill: COLORS.accent,
      onClick: () => this.scene.start('Intro', { levelId: current.id }),
    })
    createButton(this, {
      x: GAME.width / 2,
      y: 496,
      width: 280,
      height: 50,
      label: 'LEVELS',
      fill: COLORS.info,
      onClick: () => this.scene.start('LevelSelect'),
    })
    createButton(this, {
      x: GAME.width / 2,
      y: 556,
      width: 280,
      height: 50,
      label: 'SHOP',
      fill: 0xc9a227,
      onClick: () => this.scene.start('Shop'),
    })
    createButton(this, {
      x: GAME.width / 2,
      y: 616,
      width: 280,
      height: 50,
      label: 'SETTINGS',
      fill: COLORS.bgPanel,
      onClick: () => this.scene.start('Settings'),
    })

    const daily = LEVELS[0]!
    const panel = this.add.graphics()
    panel.fillStyle(COLORS.bgPanel, 0.92)
    panel.fillRoundedRect(28, 680, GAME.width - 56, 100, 18)
    this.add.text(48, 698, 'Daily Challenge', {
      fontFamily: FONT.display,
      fontSize: '16px',
      color: '#ffd166',
      fontStyle: '800',
    })
    this.add.text(48, 726, daily.dailyChallengeText ?? daily.rewards.challenge, {
      fontFamily: FONT.body,
      fontSize: '13px',
      color: '#ffffff',
      wordWrap: { width: GAME.width - 100 },
    })
  }
}
