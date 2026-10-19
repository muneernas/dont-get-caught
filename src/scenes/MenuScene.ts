import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import { mergeSave } from '../systems/merge/MergeSave'
import { audioSystem } from '../systems/AudioSystem'
import { createButton } from '../ui/Button'
import { addFloatingOrbs, drawVerticalGradient } from '../ui/Background'

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu')
  }

  create(): void {
    audioSystem.unlock()
    mergeSave.regenEnergy()
    drawVerticalGradient(this, 0x7ec8e3, 0xf7ffe8)
    addFloatingOrbs(this, 0xffffff, 12)
    addFloatingOrbs(this, COLORS.gold, 8)

    if (this.textures.exists('merge_hero')) {
      const glow = this.add.circle(GAME.width / 2, 150, 118, 0xffc93c, 0.25)
      this.tweens.add({
        targets: glow,
        scale: 1.08,
        alpha: 0.12,
        duration: 1200,
        yoyo: true,
        repeat: -1,
      })
      const hero = this.add.image(GAME.width / 2, 150, 'merge_hero')
      hero.setDisplaySize(210, 210)
      this.add.circle(GAME.width / 2, 150, 108, 0x000000, 0).setStrokeStyle(6, 0xffffff, 0.95)
      this.tweens.add({
        targets: hero,
        y: hero.y - 6,
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    this.add
      .text(GAME.width / 2, 278, 'MERGE HAVEN', {
        fontFamily: FONT.display,
        fontSize: '36px',
        color: '#1a2744',
        fontStyle: '900',
        stroke: '#ffffff',
        strokeThickness: 8,
      })
      .setOrigin(0.5)

    this.add
      .text(GAME.width / 2, 316, 'Craft · tap orange ! · restore your Haven', {
        fontFamily: FONT.body,
        fontSize: '13px',
        color: '#334155',
        fontStyle: '700',
      })
      .setOrigin(0.5)

    const d = mergeSave.data
    const chip = this.add.graphics()
    chip.fillStyle(0xffffff, 0.92)
    chip.fillRoundedRect(48, 338, GAME.width - 96, 36, 14)
    this.add
      .text(
        GAME.width / 2,
        356,
        `Lv ${d.level}  ·  ${d.coins}🪙  ·  ★${d.stars}  ·  ⚡${d.energy}/${mergeSave.maxEnergy()}`,
        {
          fontFamily: FONT.body,
          fontSize: '13px',
          color: '#b45309',
          fontStyle: '800',
        },
      )
      .setOrigin(0.5)

    createButton(this, {
      x: GAME.width / 2,
      y: 420,
      width: 280,
      height: 54,
      label: 'PLAY HAVEN',
      fill: COLORS.accent,
      onClick: () => this.scene.start('Merge'),
    })
    createButton(this, {
      x: GAME.width / 2,
      y: 486,
      width: 280,
      height: 50,
      label: 'HAVEN MAP ★',
      fill: 0x16a34a,
      onClick: () => this.scene.start('Story'),
    })
    createButton(this, {
      x: GAME.width / 2,
      y: 548,
      width: 280,
      height: 48,
      label: 'SHOP',
      fill: 0xf59e0b,
      textColor: '#1a2744',
      onClick: () => this.scene.start('Shop'),
    })
    createButton(this, {
      x: GAME.width / 2,
      y: 606,
      width: 280,
      height: 48,
      label: 'SETTINGS',
      fill: 0x64748b,
      onClick: () => this.scene.start('Settings'),
    })

    const panel = this.add.graphics()
    panel.fillStyle(0x000000, 0.08)
    panel.fillRoundedRect(30, 682, GAME.width - 56, 100, 18)
    panel.fillStyle(0xffffff, 0.96)
    panel.fillRoundedRect(28, 680, GAME.width - 56, 100, 18)
    this.add.text(48, 698, 'Daily Gift', {
      fontFamily: FONT.display,
      fontSize: '16px',
      color: '#b45309',
      fontStyle: '800',
    })
    this.add.text(48, 726, 'Coins + a star for your Haven.', {
      fontFamily: FONT.body,
      fontSize: '13px',
      color: '#475569',
      fontStyle: '700',
    })
    createButton(this, {
      x: GAME.width - 78,
      y: 730,
      width: 88,
      height: 40,
      label: 'CLAIM',
      fill: COLORS.success,
      fontSize: 14,
      onClick: () => {
        const r = mergeSave.claimDaily()
        audioSystem.play(r ? 'coins' : 'click')
        this.scene.restart()
      },
    })
  }
}
