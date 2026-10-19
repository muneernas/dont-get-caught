import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import { STORY_NODES } from '../data/merge/story'
import { mergeSave } from '../systems/merge/MergeSave'
import { audioSystem } from '../systems/AudioSystem'
import { hapticsSystem } from '../systems/HapticsSystem'
import { createButton } from '../ui/Button'

export class StoryScene extends Phaser.Scene {
  private toast!: Phaser.GameObjects.Text

  constructor() {
    super('Story')
  }

  create(): void {
    for (const key of ['Menu', 'Merge', 'Shop', 'Settings']) {
      if (this.scene.isActive(key) || this.scene.isSleeping(key)) this.scene.stop(key)
    }

    if (this.textures.exists('story_map_bg')) {
      const bg = this.add.image(GAME.width / 2, GAME.height / 2, 'story_map_bg')
      bg.setDisplaySize(GAME.width, GAME.height)
      bg.setAlpha(0.9)
    } else {
      this.cameras.main.setBackgroundColor(COLORS.bgDeep)
    }

    const dim = this.add.graphics()
    dim.fillStyle(0x1a1033, 0.35)
    dim.fillRect(0, 0, GAME.width, GAME.height)

    this.add
      .text(GAME.width / 2, 48, 'HAVEN STORY', {
        fontFamily: FONT.display,
        fontSize: '26px',
        color: '#ffffff',
        fontStyle: '900',
        stroke: '#1a1033',
        strokeThickness: 5,
      })
      .setOrigin(0.5)

    this.add
      .text(GAME.width / 2, 78, 'Earn ★ on orders · spend here to restore Haven', {
        fontFamily: FONT.body,
        fontSize: '12px',
        color: '#ffd166',
      })
      .setOrigin(0.5)

    this.add
      .text(GAME.width / 2, 102, `★ ${mergeSave.data.stars} stars`, {
        fontFamily: FONT.display,
        fontSize: '18px',
        color: '#ffd166',
        fontStyle: '800',
      })
      .setOrigin(0.5)

    createButton(this, {
      x: 44,
      y: 48,
      width: 56,
      height: 36,
      label: '←',
      fill: COLORS.bgPanel,
      fontSize: 20,
      onClick: () => this.scene.start('Menu'),
    })

    this.toast = this.add
      .text(GAME.width / 2, 780, '', {
        fontFamily: FONT.body,
        fontSize: '14px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 340 },
        stroke: '#1a1033',
        strokeThickness: 4,
      })
      .setOrigin(0.5)

    // Path lines
    const lines = this.add.graphics()
    lines.lineStyle(4, 0xffd166, 0.35)
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

    STORY_NODES.forEach((node) => this.drawNode(node))
  }

  private drawNode(node: (typeof STORY_NODES)[number]): void {
    const unlocked = mergeSave.data.unlockedStory.includes(node.id)
    const canTry = mergeSave.canUnlockStory(node.id)
    const prereqMet = node.requires.every((r) => mergeSave.data.unlockedStory.includes(r))
    const x = node.x * GAME.width
    const y = node.y * GAME.height

    const g = this.add.graphics()
    const fill = unlocked ? node.color : prereqMet ? COLORS.card : 0x2a2040
    g.fillStyle(fill, unlocked ? 1 : 0.85)
    g.fillCircle(x, y, 36)
    g.lineStyle(3, unlocked ? 0xffffff : canTry.ok ? COLORS.gold : 0x6b7280, 0.8)
    g.strokeCircle(x, y, 36)

    this.add
      .text(x, y - 4, unlocked ? node.emoji : prereqMet ? node.emoji : '🔒', {
        fontSize: '22px',
      })
      .setOrigin(0.5)

    this.add
      .text(x, y + 48, node.title, {
        fontFamily: FONT.display,
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: '800',
        align: 'center',
        stroke: '#1a1033',
        strokeThickness: 3,
      })
      .setOrigin(0.5)

    const costLabel = unlocked
      ? 'Restored'
      : node.starCost === 0
        ? 'Free'
        : `★ ${node.starCost}`
    this.add
      .text(x, y + 66, costLabel, {
        fontFamily: FONT.body,
        fontSize: '11px',
        color: unlocked ? '#06d6a0' : '#ffd166',
      })
      .setOrigin(0.5)

    const hit = this.add.circle(x, y, 40, 0x000000, 0.001).setInteractive({ useHandCursor: true })
    hit.on('pointerup', () => this.onNode(node.id))
  }

  private onNode(nodeId: string): void {
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
    audioSystem.play('success')
    hapticsSystem.success()
    this.cameras.main.flash(200, 255, 209, 102)
    this.toast.setText(res.line ?? 'Restored!')
    this.time.delayedCall(700, () => this.scene.restart())
  }
}
