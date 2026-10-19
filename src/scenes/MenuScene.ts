import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import { MAX_ENERGY } from '../data/merge/items'
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
    drawVerticalGradient(this, COLORS.bgNavy, COLORS.bgDeep)
    addFloatingOrbs(this, COLORS.accent, 10)
    addFloatingOrbs(this, COLORS.gold, 6)

    if (this.textures.exists('merge_hero')) {
      const hero = this.add.image(GAME.width / 2, 175, 'merge_hero')
      hero.setDisplaySize(240, 240)
      this.add.circle(GAME.width / 2, 175, 122, 0x000000, 0).setStrokeStyle(5, COLORS.gold, 0.5)
      this.tweens.add({
        targets: hero,
        y: hero.y - 5,
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    this.add
      .text(GAME.width / 2, 310, 'MERGE HAVEN', {
        fontFamily: FONT.display,
        fontSize: '36px',
        color: '#ffffff',
        fontStyle: '900',
        stroke: '#1a1033',
        strokeThickness: 6,
      })
      .setOrigin(0.5)

    this.add
      .text(GAME.width / 2, 352, 'One more merge. You know you want to.', {
        fontFamily: FONT.body,
        fontSize: '14px',
        color: '#c4b5e0',
      })
      .setOrigin(0.5)

    const d = mergeSave.data
    this.add
      .text(
        GAME.width / 2,
        390,
        `Lv ${d.level}  ·  ${d.coins} coins  ·  ${d.energy}/${MAX_ENERGY}⚡`,
        {
          fontFamily: FONT.body,
          fontSize: '13px',
          color: '#ffd166',
        },
      )
      .setOrigin(0.5)

    createButton(this, {
      x: GAME.width / 2,
      y: 460,
      width: 280,
      height: 58,
      label: 'PLAY',
      fill: COLORS.accent,
      onClick: () => this.scene.start('Merge'),
    })
    createButton(this, {
      x: GAME.width / 2,
      y: 532,
      width: 280,
      height: 50,
      label: 'SHOP',
      fill: 0xc9a227,
      onClick: () => this.scene.start('Shop'),
    })
    createButton(this, {
      x: GAME.width / 2,
      y: 596,
      width: 280,
      height: 50,
      label: 'SETTINGS',
      fill: COLORS.bgPanel,
      onClick: () => this.scene.start('Settings'),
    })

    const panel = this.add.graphics()
    panel.fillStyle(COLORS.bgPanel, 0.92)
    panel.fillRoundedRect(28, 670, GAME.width - 56, 110, 18)
    this.add.text(48, 690, 'Daily Gift', {
      fontFamily: FONT.display,
      fontSize: '16px',
      color: '#ffd166',
      fontStyle: '800',
    })
    this.add.text(48, 718, 'Claim free coins every day. Soft streak fuel.', {
      fontFamily: FONT.body,
      fontSize: '13px',
      color: '#ffffff',
      wordWrap: { width: 200 },
    })
    createButton(this, {
      x: GAME.width - 78,
      y: 725,
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
