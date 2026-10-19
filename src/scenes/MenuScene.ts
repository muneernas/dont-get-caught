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
    drawVerticalGradient(this, COLORS.bgNavy, COLORS.bgDeep)
    addFloatingOrbs(this, COLORS.accent, 10)
    addFloatingOrbs(this, COLORS.gold, 6)

    if (this.textures.exists('merge_hero')) {
      const hero = this.add.image(GAME.width / 2, 155, 'merge_hero')
      hero.setDisplaySize(220, 220)
      this.add.circle(GAME.width / 2, 155, 112, 0x000000, 0).setStrokeStyle(5, COLORS.gold, 0.55)
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
      .text(GAME.width / 2, 288, 'MERGE HAVEN', {
        fontFamily: FONT.display,
        fontSize: '34px',
        color: '#ffffff',
        fontStyle: '900',
        stroke: '#1a1033',
        strokeThickness: 6,
      })
      .setOrigin(0.5)

    this.add
      .text(GAME.width / 2, 326, 'Merge on the board · spend ★ on the story', {
        fontFamily: FONT.body,
        fontSize: '13px',
        color: '#c4b5e0',
      })
      .setOrigin(0.5)

    const d = mergeSave.data
    this.add
      .text(
        GAME.width / 2,
        358,
        `Lv ${d.level}  ·  ${d.coins}🪙  ·  ★${d.stars}  ·  ⚡${d.energy}/${mergeSave.maxEnergy()}`,
        {
          fontFamily: FONT.body,
          fontSize: '13px',
          color: '#ffd166',
        },
      )
      .setOrigin(0.5)

    createButton(this, {
      x: GAME.width / 2,
      y: 420,
      width: 280,
      height: 54,
      label: 'PLAY BOARD',
      fill: COLORS.accent,
      onClick: () => this.scene.start('Merge'),
    })
    createButton(this, {
      x: GAME.width / 2,
      y: 486,
      width: 280,
      height: 50,
      label: 'HAVEN STORY ★',
      fill: 0x7c3aed,
      onClick: () => this.scene.start('Story'),
    })
    createButton(this, {
      x: GAME.width / 2,
      y: 548,
      width: 280,
      height: 48,
      label: 'SHOP',
      fill: 0xc9a227,
      onClick: () => this.scene.start('Shop'),
    })
    createButton(this, {
      x: GAME.width / 2,
      y: 606,
      width: 280,
      height: 48,
      label: 'SETTINGS',
      fill: COLORS.bgPanel,
      onClick: () => this.scene.start('Settings'),
    })

    const panel = this.add.graphics()
    panel.fillStyle(COLORS.bgPanel, 0.92)
    panel.fillRoundedRect(28, 680, GAME.width - 56, 100, 18)
    this.add.text(48, 698, 'Daily Gift', {
      fontFamily: FONT.display,
      fontSize: '16px',
      color: '#ffd166',
      fontStyle: '800',
    })
    this.add.text(48, 726, 'Coins + a star for your Haven.', {
      fontFamily: FONT.body,
      fontSize: '13px',
      color: '#ffffff',
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
