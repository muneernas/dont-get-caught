import Phaser from 'phaser'
import { FONT, GAME } from '../config/theme'
import { STORY_NODES } from '../data/merge/story'
import { mergeSave } from '../systems/merge/MergeSave'
import { audioSystem } from '../systems/AudioSystem'
import { hapticsSystem } from '../systems/HapticsSystem'
import { Juice } from '../systems/merge/Juice'
import { createButton } from '../ui/Button'

export class StoryScene extends Phaser.Scene {
  private toast!: Phaser.GameObjects.Text
  private juice!: Juice

  constructor() {
    super('Story')
  }

  create(): void {
    for (const key of ['Menu', 'Merge', 'Shop', 'Settings']) {
      if (this.scene.isActive(key) || this.scene.isSleeping(key)) this.scene.stop(key)
    }
    this.juice = new Juice(this)

    if (this.textures.exists('story_map_bg')) {
      const bg = this.add.image(GAME.width / 2, GAME.height / 2, 'story_map_bg')
      bg.setDisplaySize(GAME.width * 1.08, GAME.height * 1.08)
      this.tweens.add({
        targets: bg,
        x: bg.x + 8,
        duration: 6000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      })
    } else {
      this.cameras.main.setBackgroundColor(0x7ec8e3)
    }

    const dim = this.add.graphics()
    dim.fillStyle(0x0f1a28, 0.28)
    dim.fillRect(0, 0, GAME.width, GAME.height)

    // Soft header card
    const header = this.add.graphics()
    header.fillStyle(0xffffff, 0.94)
    header.fillRoundedRect(24, 28, GAME.width - 48, 90, 20)

    this.add
      .text(GAME.width / 2, 52, 'HAVEN MAP', {
        fontFamily: FONT.display,
        fontSize: '26px',
        color: '#1a2744',
        fontStyle: '900',
      })
      .setOrigin(0.5)

    this.add
      .text(GAME.width / 2, 78, 'Spend ★ to restore areas · unlock generators', {
        fontFamily: FONT.body,
        fontSize: '11px',
        color: '#64748b',
        fontStyle: '700',
      })
      .setOrigin(0.5)

    this.add
      .text(GAME.width / 2, 100, `★ ${mergeSave.data.stars} stars`, {
        fontFamily: FONT.display,
        fontSize: '16px',
        color: '#ca8a04',
        fontStyle: '800',
      })
      .setOrigin(0.5)

    createButton(this, {
      x: 44,
      y: 48,
      width: 56,
      height: 36,
      label: '←',
      fill: 0xffffff,
      textColor: '#1a2744',
      fontSize: 20,
      onClick: () => this.scene.start('Menu'),
    })

    this.toast = this.add
      .text(GAME.width / 2, 780, '', {
        fontFamily: FONT.body,
        fontSize: '14px',
        color: '#1a2744',
        align: 'center',
        wordWrap: { width: 340 },
        backgroundColor: '#ffffffee',
        padding: { x: 12, y: 8 },
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setDepth(20)

    const lines = this.add.graphics()
    lines.lineStyle(5, 0xffc93c, 0.55)
    for (const node of STORY_NODES) {
      for (const req of node.requires) {
        const parent = STORY_NODES.find((n) => n.id === req)
        if (!parent) continue
        lines.beginPath()
        lines.moveTo(parent.x * GAME.width, parent.y * GAME.height)
        lines.lineTo(node.x * GAME.width, node.y * GAME.height)
        lines.strokePath()
      }
    }

    STORY_NODES.forEach((node, i) => this.drawNode(node, i * 70))
  }

  private drawNode(node: (typeof STORY_NODES)[number], delay: number): void {
    const unlocked = mergeSave.data.unlockedStory.includes(node.id)
    const canTry = mergeSave.canUnlockStory(node.id)
    const prereqMet = node.requires.every((r) => mergeSave.data.unlockedStory.includes(r))
    const x = node.x * GAME.width
    const y = node.y * GAME.height

    const g = this.add.graphics()
    const fill = unlocked ? node.color : prereqMet ? 0xffffff : 0xcbd5e1
    g.fillStyle(0x000000, 0.15)
    g.fillCircle(x + 2, y + 3, 38)
    g.fillStyle(fill, 1)
    g.fillCircle(x, y, 36)
    g.lineStyle(4, unlocked ? 0xffffff : canTry.ok ? 0xffc93c : 0x94a3b8, 0.95)
    g.strokeCircle(x, y, 36)

    const emoji = this.add
      .text(x, y - 4, unlocked ? node.emoji : prereqMet ? node.emoji : '🔒', { fontSize: '22px' })
      .setOrigin(0.5)

    const title = this.add
      .text(x, y + 48, node.title, {
        fontFamily: FONT.display,
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: '800',
        align: 'center',
        stroke: '#0f1a28',
        strokeThickness: 4,
      })
      .setOrigin(0.5)

    const costLabel = unlocked
      ? 'Restored'
      : node.starCost === 0
        ? 'Free'
        : `★ ${node.starCost}`
    const cost = this.add
      .text(x, y + 66, costLabel, {
        fontFamily: FONT.body,
        fontSize: '11px',
        color: unlocked ? '#86efac' : '#ffc93c',
        fontStyle: '800',
        stroke: '#0f1a28',
        strokeThickness: 3,
      })
      .setOrigin(0.5)

    // Pop-in animation
    ;[g, emoji, title, cost].forEach((obj) => {
      obj.setScale(0.2)
      obj.setAlpha(0)
      this.tweens.add({
        targets: obj,
        scale: 1,
        alpha: 1,
        duration: 380,
        delay,
        ease: 'Back.out',
      })
    })

    const hit = this.add.circle(x, y, 40, 0x000000, 0.001).setInteractive({ useHandCursor: true })
    hit.on('pointerdown', () => this.juice.press(emoji))
    hit.on('pointerup', () => this.onNode(node.id, x, y))
  }

  private onNode(nodeId: string, x: number, y: number): void {
    if (mergeSave.data.unlockedStory.includes(nodeId)) {
      const node = STORY_NODES.find((n) => n.id === nodeId)!
      this.toast.setText(node.line)
      audioSystem.play('click')
      return
    }
    const res = mergeSave.unlockStory(nodeId)
    if (!res.ok) {
      this.toast.setText(res.reason ?? 'Not yet')
      audioSystem.play('warning')
      hapticsSystem.warn()
      return
    }
    this.juice.starsBurst(x, y)
    this.cameras.main.flash(200, 255, 230, 150)
    this.toast.setText(res.line ?? 'Restored!')
    this.time.delayedCall(700, () => this.scene.restart())
  }
}
