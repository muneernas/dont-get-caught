import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import {
  ENERGY_REGEN_MS,
  GENERATORS,
  ITEM_BY_ID,
  type GeneratorDef,
} from '../data/merge/items'
import { HOTSPOTS, SCENE_HEIGHT, SCENE_WIDTH, nextQuest, type HavenHotspot } from '../data/merge/quests'
import { BoardModel, cellUnlockLevel } from '../systems/merge/BoardModel'
import { mergeSave } from '../systems/merge/MergeSave'
import { audioSystem } from '../systems/AudioSystem'
import { hapticsSystem } from '../systems/HapticsSystem'
import { monetization } from '../monetization/stubs'
import { createButton } from '../ui/Button'

interface TokenView {
  uid: string
  itemId: string
  gx: number
  gy: number
  container: Phaser.GameObjects.Container
}

/** Prison-like layout constants (Haven story content). */
const SCENE_TOP = 48
const SCENE_VIEW_H = 210
const QUEST_Y = 268
const BOARD_TOP = 318
const TRAY_Y = 592
const ORDERS_Y = 668

export class MergeScene extends Phaser.Scene {
  private board!: BoardModel
  private tokens = new Map<string, TokenView>()
  private cellSize = 48
  private gridOriginX = 0
  private gridOriginY = 0
  private dragging: TokenView | null = null
  private dragOffset = { x: 0, y: 0 }
  private selected: TokenView | null = null
  private genReadyText: Phaser.GameObjects.Text[] = []
  private hudCoins!: Phaser.GameObjects.Text
  private hudStars!: Phaser.GameObjects.Text
  private hudEnergy!: Phaser.GameObjects.Text
  private hudLevel!: Phaser.GameObjects.Text
  private highlight!: Phaser.GameObjects.Graphics
  private trayName!: Phaser.GameObjects.Text
  private trayHint!: Phaser.GameObjects.Text
  private questLabel!: Phaser.GameObjects.Text
  private questIcon!: Phaser.GameObjects.Image | Phaser.GameObjects.Text
  private sceneRoot!: Phaser.GameObjects.Container
  private sceneScrollX = 0
  private hotspotMarks = new Map<string, Phaser.GameObjects.Container>()
  private speechBubble!: Phaser.GameObjects.Container
  private gridGfx!: Phaser.GameObjects.Graphics
  private ordersLayer!: Phaser.GameObjects.Container

  constructor() {
    super('Merge')
  }

  create(): void {
    for (const key of ['Menu', 'Shop', 'Settings', 'Boot', 'Story']) {
      if (this.scene.isActive(key) || this.scene.isSleeping(key)) this.scene.stop(key)
    }

    mergeSave.regenEnergy()
    this.board = new BoardModel(mergeSave.data.board)
    this.tokens.clear()
    this.genReadyText = []
    this.selected = null
    this.dragging = null
    this.hotspotMarks.clear()
    this.sceneScrollX = 0

    this.cameras.main.setBackgroundColor(0x1a2744)

    this.cellSize = 48
    const gridW = this.board.cols * this.cellSize
    this.gridOriginX = (GAME.width - gridW) / 2 + this.cellSize / 2
    this.gridOriginY = BOARD_TOP + 36

    this.buildStoryScene()
    this.buildHud()
    this.buildQuestStrip()
    this.drawGrid()
    this.highlight = this.add.graphics().setDepth(5)
    this.rebuildTokens()
    this.buildGenerators()
    this.buildSelectionTray()
    this.buildOrders()
    this.buildSpeechBubble()

    createButton(this, {
      x: 28,
      y: 24,
      width: 44,
      height: 30,
      label: '←',
      fill: COLORS.bgPanel,
      fontSize: 16,
      onClick: () => {
        this.persistBoard()
        this.scene.start('Menu')
      },
    })
    createButton(this, {
      x: GAME.width - 48,
      y: 24,
      width: 70,
      height: 30,
      label: 'MAP ★',
      fill: 0xe07a3d,
      fontSize: 11,
      onClick: () => {
        this.persistBoard()
        this.scene.start('Story')
      },
    })

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onDrag(p))
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onDrop(p))
    this.time.addEvent({ delay: 400, loop: true, callback: () => this.tickUi() })
  }

  private buildHud(): void {
    const bar = this.add.graphics().setDepth(40)
    bar.fillStyle(0x122033, 0.82)
    bar.fillRoundedRect(70, 10, GAME.width - 150, 28, 10)

    this.hudCoins = this.add
      .text(80, 24, '', { fontFamily: FONT.display, fontSize: '12px', color: '#ffd166', fontStyle: '800' })
      .setOrigin(0, 0.5)
      .setDepth(41)
    this.hudStars = this.add
      .text(155, 24, '', { fontFamily: FONT.display, fontSize: '12px', color: '#fde68a', fontStyle: '800' })
      .setOrigin(0, 0.5)
      .setDepth(41)
    this.hudEnergy = this.add
      .text(220, 24, '', { fontFamily: FONT.body, fontSize: '11px', color: '#7dd3fc' })
      .setOrigin(0, 0.5)
      .setDepth(41)
    this.hudLevel = this.add
      .text(GAME.width - 90, 24, '', {
        fontFamily: FONT.display,
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: '800',
      })
      .setOrigin(1, 0.5)
      .setDepth(41)

    this.refreshHud()
  }

  private refreshHud(): void {
    mergeSave.regenEnergy()
    const d = mergeSave.data
    const max = mergeSave.maxEnergy()
    this.hudCoins?.setText(`🪙${d.coins}`)
    this.hudStars?.setText(`★${d.stars}`)
    const next = mergeSave.msToNextEnergy()
    const tip = d.energy >= max ? 'full' : `${Math.ceil(next / 1000)}s`
    this.hudEnergy?.setText(`⚡${d.energy}/${max} ${tip}`)
    this.hudLevel?.setText(`Lv${d.level}`)
    this.refreshGenLabels()
  }

  private buildStoryScene(): void {
    const maskShape = this.make.graphics({ x: 0, y: 0 })
    maskShape.fillStyle(0xffffff)
    maskShape.fillRoundedRect(8, SCENE_TOP, GAME.width - 16, SCENE_VIEW_H, 16)
    const mask = maskShape.createGeometryMask()

    this.sceneRoot = this.add.container(0, SCENE_TOP).setDepth(2)
    this.sceneRoot.setMask(mask)

    const frame = this.add.graphics().setDepth(3)
    frame.lineStyle(3, 0xffd166, 0.55)
    frame.strokeRoundedRect(8, SCENE_TOP, GAME.width - 16, SCENE_VIEW_H, 16)

    let scrollStart = 0
    let pointerStart = 0
    const onSceneScrollDown = (p: Phaser.Input.Pointer) => {
      if (this.dragging) return
      scrollStart = this.sceneScrollX
      pointerStart = p.x
    }
    const onSceneScrollMove = (p: Phaser.Input.Pointer) => {
      if (this.dragging || !p.isDown) return
      if (Math.abs(p.x - pointerStart) < 4) return
      const maxScroll = Math.max(0, SCENE_WIDTH - (GAME.width - 16))
      this.sceneScrollX = Phaser.Math.Clamp(scrollStart - (p.x - pointerStart), 0, maxScroll)
      this.sceneRoot.x = 8 - this.sceneScrollX
    }

    if (this.textures.exists('haven_scene')) {
      const bg = this.add.image(0, 0, 'haven_scene').setOrigin(0, 0)
      bg.setDisplaySize(SCENE_WIDTH, SCENE_HEIGHT)
      bg.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, SCENE_WIDTH, SCENE_HEIGHT),
        Phaser.Geom.Rectangle.Contains,
      )
      bg.on('pointerdown', onSceneScrollDown)
      bg.on('pointermove', onSceneScrollMove)
      this.sceneRoot.add(bg)
    } else {
      const g = this.add.graphics()
      g.fillGradientStyle(0x6bb3c0, 0x6bb3c0, 0x3d7a4a, 0x3d7a4a, 1)
      g.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT)
      this.sceneRoot.add(g)
    }

    this.add
      .text(GAME.width / 2, SCENE_TOP + SCENE_VIEW_H - 10, '⟷ drag scene · tap ! to restore', {
        fontFamily: FONT.body,
        fontSize: '10px',
        color: '#ffffff',
        stroke: '#122033',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(4)

    for (const hs of HOTSPOTS) this.spawnHotspotMark(hs)
    this.sceneRoot.x = 8
  }

  private spawnHotspotMark(hs: HavenHotspot): void {
    const done = mergeSave.isHotspotDone(hs.id)
    const areaOpen = mergeSave.data.unlockedStory.includes(hs.areaId)
    if (!areaOpen && !done) {
      // Hidden until area restored — skip mark
      return
    }

    const mark = this.add.container(hs.x, hs.y)
    const ready = mergeSave.hotspotReady(hs)
    const color = done ? 0x06d6a0 : ready.orange ? 0xff7a18 : 0xf5f5f5
    const ring = this.add.circle(0, 0, 16, color, done ? 0.85 : 1)
    ring.setStrokeStyle(3, 0x1a1033, 0.55)
    const bang = this.add
      .text(0, 0, done ? '✓' : '!', {
        fontFamily: FONT.display,
        fontSize: done ? '16px' : '22px',
        color: done ? '#ffffff' : ready.orange ? '#ffffff' : '#334155',
        fontStyle: '900',
      })
      .setOrigin(0.5)
    mark.add([ring, bang])
    mark.setSize(36, 36)
    mark.setInteractive(new Phaser.Geom.Circle(0, 0, 18), Phaser.Geom.Circle.Contains)
    mark.on('pointerup', () => this.onHotspotTap(hs))
    // Pulse orange
    if (ready.orange && !done) {
      this.tweens.add({
        targets: mark,
        scale: 1.12,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      })
    }
    this.sceneRoot.add(mark)
    this.hotspotMarks.set(hs.id, mark)
  }

  private refreshHotspots(): void {
    for (const mark of this.hotspotMarks.values()) mark.destroy(true)
    this.hotspotMarks.clear()
    for (const hs of HOTSPOTS) this.spawnHotspotMark(hs)
  }

  private onHotspotTap(hs: HavenHotspot): void {
    if (mergeSave.isHotspotDone(hs.id)) {
      this.showSpeech(hs.character, hs.line)
      return
    }
    const ready = mergeSave.hotspotReady(hs)
    if (!ready.orange) {
      audioSystem.play('warning')
      this.floatText(GAME.width / 2, QUEST_Y - 8, ready.reason ?? 'Not ready', COLORS.warn)
      // Auto-scroll quest into view
      this.refreshQuestStrip()
      return
    }
    // Need selected matching item
    if (!this.selected || this.selected.itemId !== hs.needItemId) {
      // Try auto-select first matching on board
      const match = [...this.tokens.values()].find((t) => t.itemId === hs.needItemId)
      if (match) this.selectToken(match)
      else {
        this.floatText(GAME.width / 2, QUEST_Y - 8, 'Craft & select the item', COLORS.warn)
        return
      }
    }
    if (!this.selected) return
    const res = mergeSave.completeHotspot(hs, this.selected.uid)
    if (!res.ok) {
      this.floatText(GAME.width / 2, QUEST_Y - 8, res.reason ?? 'Fail', COLORS.warn)
      audioSystem.play('warning')
      return
    }
    // Remove token view
    this.selected.container.destroy(true)
    this.tokens.delete(this.selected.uid)
    this.selected = null
    this.board = new BoardModel(mergeSave.data.board)
    this.updateTray()
    this.refreshHotspots()
    this.refreshQuestStrip()
    this.refreshHud()
    audioSystem.play('success')
    hapticsSystem.success()
    this.cameras.main.flash(160, 255, 200, 120)
    this.showSpeech(hs.character, res.line ?? hs.line)
    this.floatText(GAME.width / 2, SCENE_TOP + 40, `+${hs.rewardStars}★ restored!`, COLORS.gold)
  }

  private buildSpeechBubble(): void {
    this.speechBubble = this.add.container(GAME.width / 2, SCENE_TOP + 36).setDepth(50).setAlpha(0)
    const bg = this.add.graphics()
    bg.fillStyle(0xfff8ef, 0.96)
    bg.fillRoundedRect(-160, -28, 320, 56, 14)
    bg.lineStyle(2, 0xe07a3d, 0.8)
    bg.strokeRoundedRect(-160, -28, 320, 56, 14)
    const text = this.add
      .text(0, 0, '', {
        fontFamily: FONT.body,
        fontSize: '12px',
        color: '#1a2744',
        align: 'center',
        wordWrap: { width: 300 },
      })
      .setOrigin(0.5)
    this.speechBubble.add([bg, text])
    ;(this.speechBubble as Phaser.GameObjects.Container & { label?: Phaser.GameObjects.Text }).label = text
  }

  private showSpeech(character: string, line: string): void {
    const label = (this.speechBubble as Phaser.GameObjects.Container & { label?: Phaser.GameObjects.Text })
      .label
    label?.setText(`${character}: “${line}”`)
    this.speechBubble.setAlpha(1)
    this.tweens.killTweensOf(this.speechBubble)
    this.tweens.add({
      targets: this.speechBubble,
      alpha: 0,
      delay: 2800,
      duration: 400,
    })
  }

  private buildQuestStrip(): void {
    const g = this.add.graphics()
    g.fillStyle(0xfff4e0, 0.95)
    g.fillRoundedRect(10, QUEST_Y - 22, GAME.width - 20, 44, 12)
    g.lineStyle(2, 0xe07a3d, 0.7)
    g.strokeRoundedRect(10, QUEST_Y - 22, GAME.width - 20, 44, 12)

    this.add
      .text(22, QUEST_Y - 8, 'QUEST', {
        fontFamily: FONT.display,
        fontSize: '10px',
        color: '#e07a3d',
        fontStyle: '900',
      })
      .setOrigin(0, 0.5)

    this.questLabel = this.add
      .text(70, QUEST_Y - 8, '', {
        fontFamily: FONT.body,
        fontSize: '12px',
        color: '#1a2744',
        fontStyle: '700',
      })
      .setOrigin(0, 0.5)

    this.questIcon = this.add.text(GAME.width - 36, QUEST_Y - 8, '?', { fontSize: '20px' }).setOrigin(0.5)
    this.refreshQuestStrip()
  }

  private refreshQuestStrip(): void {
    const q = nextQuest(mergeSave.data.completedHotspots, mergeSave.data.unlockedStory)
    if (!q) {
      this.questLabel.setText('Open MAP ★ to restore a new area')
      if (this.questIcon instanceof Phaser.GameObjects.Text) this.questIcon.setText('★')
      return
    }
    const def = ITEM_BY_ID[q.needItemId]
    const starBit = q.starCost > 0 ? ` · ★${q.starCost}` : ''
    this.questLabel.setText(`Craft ${def?.name ?? q.needItemId} → ${q.title}${starBit}`)
    if (this.textures.exists(def?.texture ?? '') && def) {
      if (this.questIcon instanceof Phaser.GameObjects.Text) {
        this.questIcon.destroy()
        const img = this.add.image(GAME.width - 36, QUEST_Y - 8, def.texture)
        img.setDisplaySize(32, 32)
        this.questIcon = img
      } else {
        this.questIcon.setTexture(def.texture)
        this.questIcon.setDisplaySize(32, 32)
      }
    } else if (this.questIcon instanceof Phaser.GameObjects.Text) {
      this.questIcon.setText(def?.emoji ?? '!')
    }
  }

  private drawGrid(): void {
    if (this.gridGfx) this.gridGfx.destroy()
    this.gridGfx = this.add.graphics()
    const level = mergeSave.data.level
    for (let y = 0; y < this.board.rows; y++) {
      for (let x = 0; x < this.board.cols; x++) {
        const cx = this.gridOriginX + x * this.cellSize
        const cy = this.gridOriginY + y * this.cellSize
        const open = this.board.isUnlocked(x, y, level)
        if (open) {
          this.gridGfx.fillStyle(0xffffff, 0.28)
          this.gridGfx.fillRoundedRect(cx - 22, cy - 22, 44, 44, 10)
          this.gridGfx.lineStyle(2, 0xffffff, 0.5)
          this.gridGfx.strokeRoundedRect(cx - 22, cy - 22, 44, 44, 10)
        } else {
          this.gridGfx.fillStyle(0x3a4558, 0.85)
          this.gridGfx.fillRoundedRect(cx - 22, cy - 22, 44, 44, 10)
          // Bars
          this.gridGfx.lineStyle(2, 0x9aa3b2, 0.7)
          for (let i = -14; i <= 14; i += 7) {
            this.gridGfx.lineBetween(cx + i, cy - 16, cx + i, cy + 16)
          }
          const need = cellUnlockLevel(x, y)
          this.add
            .text(cx, cy, `Lv${need}`, {
              fontFamily: FONT.display,
              fontSize: '10px',
              color: '#ffd166',
              fontStyle: '800',
            })
            .setOrigin(0.5)
            .setDepth(6)
        }
      }
    }
  }

  private cellCenter(gx: number, gy: number): { x: number; y: number } {
    return {
      x: this.gridOriginX + gx * this.cellSize,
      y: this.gridOriginY + gy * this.cellSize,
    }
  }

  private pointerToCell(px: number, py: number): { x: number; y: number } | null {
    const x = Math.round((px - this.gridOriginX) / this.cellSize)
    const y = Math.round((py - this.gridOriginY) / this.cellSize)
    if (!this.board.inBounds(x, y)) return null
    return { x, y }
  }

  private rebuildTokens(): void {
    for (const t of this.tokens.values()) t.container.destroy(true)
    this.tokens.clear()
    for (let y = 0; y < this.board.rows; y++) {
      for (let x = 0; x < this.board.cols; x++) {
        const cell = this.board.get(x, y)
        if (cell) this.spawnTokenView(cell.uid, cell.itemId, x, y, false)
      }
    }
  }

  private spawnTokenView(uid: string, itemId: string, gx: number, gy: number, pop: boolean): void {
    const def = ITEM_BY_ID[itemId]
    if (!def) return
    const pos = this.cellCenter(gx, gy)

    const shadow = this.add.ellipse(0, 16, 32, 10, 0x000000, 0.25)
    let art: Phaser.GameObjects.GameObject
    if (this.textures.exists(def.texture)) {
      const img = this.add.image(0, 0, def.texture)
      img.setDisplaySize(40, 40)
      art = img
    } else {
      const body = this.add.graphics()
      body.fillStyle(def.color, 1)
      body.fillRoundedRect(-18, -18, 36, 36, 10)
      const emoji = this.add.text(0, 0, def.emoji, { fontSize: '20px' }).setOrigin(0.5)
      art = this.add.container(0, 0, [body, emoji])
    }
    const tier = this.add
      .text(14, 14, `${def.tier}`, {
        fontFamily: FONT.body,
        fontSize: '10px',
        color: '#1a1033',
        fontStyle: '800',
        backgroundColor: '#ffd166',
        padding: { x: 3, y: 0 },
      })
      .setOrigin(0.5)

    const container = this.add.container(pos.x, pos.y, [shadow, art, tier]).setSize(42, 42)
    container.setDepth(10)
    container.setInteractive(new Phaser.Geom.Rectangle(-21, -21, 42, 42), Phaser.Geom.Rectangle.Contains)

    const view: TokenView = { uid, itemId, gx, gy, container }
    this.tokens.set(uid, view)

    container.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.dragging) return
      this.selectToken(view)
      this.dragging = view
      this.dragOffset = { x: container.x - p.x, y: container.y - p.y }
      container.setDepth(30)
      this.tweens.add({ targets: container, scale: 1.12, duration: 70 })
      audioSystem.play('click')
      hapticsSystem.tap()
    })

    if (pop) {
      container.setScale(0.15)
      this.tweens.add({ targets: container, scale: 1, duration: 220, ease: 'Back.out' })
    }
  }

  private selectToken(view: TokenView): void {
    this.selected = view
    this.updateTray()
  }

  private buildSelectionTray(): void {
    const g = this.add.graphics()
    g.fillStyle(0xfff8e7, 0.96)
    g.fillRoundedRect(12, TRAY_Y, GAME.width - 24, 58, 14)
    g.lineStyle(3, 0xf5c542, 0.95)
    g.strokeRoundedRect(12, TRAY_Y, GAME.width - 24, 58, 14)

    this.trayName = this.add
      .text(28, TRAY_Y + 18, 'Tap an item', {
        fontFamily: FONT.display,
        fontSize: '14px',
        color: '#1a2744',
        fontStyle: '800',
      })
      .setOrigin(0, 0.5)
    this.trayHint = this.add
      .text(28, TRAY_Y + 40, 'Merge matches · use crafted pieces on orange !', {
        fontFamily: FONT.body,
        fontSize: '11px',
        color: '#5b6475',
      })
      .setOrigin(0, 0.5)
  }

  private updateTray(): void {
    if (!this.selected) {
      this.trayName.setText('Tap an item')
      this.trayHint.setText('Merge matches · use crafted pieces on orange !')
      return
    }
    const def = ITEM_BY_ID[this.selected.itemId]
    const q = nextQuest(mergeSave.data.completedHotspots, mergeSave.data.unlockedStory)
    this.trayName.setText(def ? `${def.name}  ·  Tier ${def.tier}` : this.selected.itemId)
    if (q && q.needItemId === this.selected.itemId) {
      this.trayHint.setText(`Use on orange ! — ${q.title}`)
    } else if (q) {
      this.trayHint.setText(`Quest needs ${ITEM_BY_ID[q.needItemId]?.name ?? q.needItemId}`)
    } else {
      this.trayHint.setText('Deliver orders for ★ · spend on MAP')
    }
  }

  private onDrag(p: Phaser.Input.Pointer): void {
    if (!this.dragging) return
    this.dragging.container.x = p.x + this.dragOffset.x
    this.dragging.container.y = p.y + this.dragOffset.y
    const cell = this.pointerToCell(this.dragging.container.x, this.dragging.container.y)
    this.highlight.clear()
    if (cell) {
      const c = this.cellCenter(cell.x, cell.y)
      const open = this.board.isUnlocked(cell.x, cell.y, mergeSave.data.level)
      const target = this.board.get(cell.x, cell.y)
      const canMerge =
        open &&
        !!target &&
        target.uid !== this.dragging.uid &&
        target.itemId === this.dragging.itemId
      this.highlight.lineStyle(4, !open ? 0x64748b : canMerge ? COLORS.success : COLORS.gold, 0.95)
      this.highlight.strokeRoundedRect(c.x - 24, c.y - 24, 48, 48, 12)
    }
  }

  private onDrop(_p: Phaser.Input.Pointer): void {
    if (!this.dragging) return
    const view = this.dragging
    this.dragging = null
    this.highlight.clear()
    view.container.setDepth(10)
    this.tweens.add({ targets: view.container, scale: 1, duration: 70 })

    const cell = this.pointerToCell(view.container.x, view.container.y)
    if (!cell) {
      this.snapToken(view)
      return
    }
    const level = mergeSave.data.level
    if (!this.board.isUnlocked(cell.x, cell.y, level)) {
      this.floatText(GAME.width / 2, BOARD_TOP, `Unlocks at Lv${cellUnlockLevel(cell.x, cell.y)}`, COLORS.warn)
      this.snapToken(view)
      return
    }

    const target = this.board.get(cell.x, cell.y)
    if (target && target.uid !== view.uid && target.itemId === view.itemId) {
      const result = this.board.tryMerge(view.gx, view.gy, cell.x, cell.y, level)
      if (result) {
        const other = this.tokens.get(target.uid)
        view.container.destroy(true)
        other?.container.destroy(true)
        this.tokens.delete(view.uid)
        this.tokens.delete(target.uid)
        this.spawnTokenView(result.item.uid, result.item.itemId, result.x, result.y, true)
        this.selected = this.tokens.get(result.item.uid) ?? null
        mergeSave.data.totalMerges += 1
        this.mergeJuice(result.x, result.y, result.def.color)
        this.persistBoard()
        this.refreshHud()
        this.refreshHotspots()
        this.refreshQuestStrip()
        this.updateTray()
        if (mergeSave.addXp(2)) {
          this.floatText(GAME.width / 2, BOARD_TOP, 'LEVEL UP! Board expands', COLORS.gold)
          this.time.delayedCall(400, () => this.scene.restart())
        }
        // Auto-prompt if quest item crafted
        const q = nextQuest(mergeSave.data.completedHotspots, mergeSave.data.unlockedStory)
        if (q && result.item.itemId === q.needItemId) {
          this.floatText(GAME.width / 2, QUEST_Y - 30, 'Quest ready — tap orange !', 0xe07a3d)
        }
        return
      }
    }

    if (!target) {
      if (this.board.tryMove(view.gx, view.gy, cell.x, cell.y, level)) {
        view.gx = cell.x
        view.gy = cell.y
        this.snapToken(view)
        this.persistBoard()
        return
      }
    }
    this.snapToken(view)
  }

  private snapToken(view: TokenView): void {
    const c = this.cellCenter(view.gx, view.gy)
    this.tweens.add({ targets: view.container, x: c.x, y: c.y, duration: 110, ease: 'Back.out' })
  }

  private mergeJuice(gx: number, gy: number, color: number): void {
    audioSystem.play('success')
    hapticsSystem.success()
    const c = this.cellCenter(gx, gy)
    this.cameras.main.shake(60, 0.004)
    for (let i = 0; i < 14; i++) {
      const p = this.add.circle(c.x, c.y, Phaser.Math.Between(3, 6), color, 0.95).setDepth(50)
      this.tweens.add({
        targets: p,
        x: c.x + Phaser.Math.Between(-48, 48),
        y: c.y + Phaser.Math.Between(-48, 48),
        alpha: 0,
        scale: 0.2,
        duration: 380,
        onComplete: () => p.destroy(),
      })
    }
    this.floatText(c.x, c.y - 22, 'MERGE!', COLORS.gold)
  }

  private floatText(x: number, y: number, msg: string, color: number): void {
    const t = this.add
      .text(x, y, msg, {
        fontFamily: FONT.display,
        fontSize: '15px',
        color: '#' + color.toString(16).padStart(6, '0'),
        fontStyle: '900',
        stroke: '#122033',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(60)
    this.tweens.add({
      targets: t,
      y: y - 36,
      alpha: 0,
      duration: 700,
      onComplete: () => t.destroy(),
    })
  }

  private buildGenerators(): void {
    const unlocked = GENERATORS.filter((g) => mergeSave.isGeneratorUnlocked(g.id))
    const locked = GENERATORS.filter((g) => !mergeSave.isGeneratorUnlocked(g.id))
    const shown = [...unlocked, ...locked]

    shown.forEach((gen, i) => {
      const x = 70 + i * 130
      const y = BOARD_TOP - 2
      const open = mergeSave.isGeneratorUnlocked(gen.id)

      const panel = this.add.graphics()
      panel.fillStyle(open ? 0x2a6f4e : 0x3a4558, 0.95)
      panel.fillRoundedRect(x - 58, y - 18, 116, 36, 12)
      panel.lineStyle(2, open ? 0x7dffb3 : 0x64748b, 0.8)
      panel.strokeRoundedRect(x - 58, y - 18, 116, 36, 12)

      // Bolt affordance
      this.add
        .text(x - 46, y, open ? '⚡' : '🔒', { fontSize: '14px' })
        .setOrigin(0.5)

      this.add
        .text(x + 8, y - 6, open ? gen.name : gen.name, {
          fontFamily: FONT.display,
          fontSize: '11px',
          color: '#ffffff',
          fontStyle: '800',
        })
        .setOrigin(0.5)

      const ready = this.add
        .text(x + 8, y + 8, '', {
          fontFamily: FONT.body,
          fontSize: '10px',
          color: '#ffd166',
        })
        .setOrigin(0.5)
      this.genReadyText[i] = ready
      ;(ready as Phaser.GameObjects.Text & { genId?: string }).genId = gen.id

      const hit = this.add
        .rectangle(x, y, 116, 36, 0x000000, 0.001)
        .setInteractive({ useHandCursor: true })
      hit.on('pointerup', () => {
        if (!open) {
          this.floatText(GAME.width / 2, BOARD_TOP, 'Restore on MAP ★ first', COLORS.gold)
          audioSystem.play('warning')
          return
        }
        this.tapGenerator(gen)
      })
    })
    this.refreshGenLabels()
  }

  private refreshGenLabels(): void {
    this.genReadyText.forEach((label) => {
      const genId = (label as Phaser.GameObjects.Text & { genId?: string }).genId
      const gen = GENERATORS.find((g) => g.id === genId)
      if (!gen || !label) return
      if (!mergeSave.isGeneratorUnlocked(gen.id)) {
        label.setText('MAP unlock')
        return
      }
      const readyAt = mergeSave.data.generatorReadyAt[gen.id] ?? 0
      const left = Math.max(0, readyAt - Date.now())
      if (left > 0) label.setText(`${Math.ceil(left / 1000)}s · ${gen.energyCost}⚡`)
      else label.setText(`TAP · ${gen.energyCost}⚡`)
    })
  }

  private tapGenerator(gen: GeneratorDef): void {
    const readyAt = mergeSave.data.generatorReadyAt[gen.id] ?? 0
    if (Date.now() < readyAt) {
      this.floatText(GAME.width / 2, BOARD_TOP, 'Cooldown…', COLORS.warn)
      return
    }
    if (!mergeSave.spendEnergy(gen.energyCost)) {
      audioSystem.play('warning')
      hapticsSystem.warn()
      this.floatText(GAME.width / 2, BOARD_TOP, 'Out of energy!', COLORS.accentHot)
      this.offerEnergyRefill()
      return
    }
    const level = mergeSave.data.level
    if (!this.board.findEmpty(level)) {
      mergeSave.data.energy = Math.min(mergeSave.maxEnergy(), mergeSave.data.energy + gen.energyCost)
      mergeSave.persist()
      this.floatText(GAME.width / 2, BOARD_TOP, 'Board full!', COLORS.warn)
      this.refreshHud()
      return
    }

    const itemId = this.rollOutput(gen)
    const spawned = this.board.spawn(itemId, level)
    if (!spawned) return
    mergeSave.data.generatorReadyAt[gen.id] = Date.now() + gen.cooldownMs
    this.spawnTokenView(spawned.item.uid, spawned.item.itemId, spawned.x, spawned.y, true)
    this.persistBoard()
    audioSystem.play('action')
    hapticsSystem.tap()
    this.refreshHud()
  }

  private rollOutput(gen: GeneratorDef): string {
    const total = gen.outputs.reduce((s, o) => s + o.weight, 0)
    let r = Math.random() * total
    for (const o of gen.outputs) {
      r -= o.weight
      if (r <= 0) return o.itemId
    }
    return gen.outputs[0]!.itemId
  }

  private offerEnergyRefill(): void {
    createButton(this, {
      x: GAME.width / 2 - 70,
      y: 820,
      width: 120,
      height: 34,
      label: 'Ad ⚡',
      fill: COLORS.info,
      fontSize: 13,
      onClick: async () => {
        const res = await monetization.showRewardedAd('energy_refill')
        if (res.watched) {
          mergeSave.refillEnergyFull()
          this.floatText(GAME.width / 2, BOARD_TOP, 'Energy full!', COLORS.success)
          this.refreshHud()
        }
      },
    })
    createButton(this, {
      x: GAME.width / 2 + 70,
      y: 820,
      width: 120,
      height: 34,
      label: '40🪙 → ⚡',
      fill: COLORS.gold,
      fontSize: 12,
      onClick: () => {
        if (mergeSave.spendCoins(40)) {
          mergeSave.refillEnergyFull()
          this.floatText(GAME.width / 2, BOARD_TOP, 'Energy full!', COLORS.success)
          this.refreshHud()
        }
      },
    })
  }

  private buildOrders(): void {
    if (this.ordersLayer) this.ordersLayer.destroy(true)
    this.ordersLayer = this.add.container(0, 0)

    const title = this.add.text(16, ORDERS_Y - 18, 'ORDERS → ★', {
      fontFamily: FONT.display,
      fontSize: '11px',
      color: '#ffd166',
      fontStyle: '800',
    })
    this.ordersLayer.add(title)

    mergeSave.data.orders.slice(0, 2).forEach((order, i) => {
      const y = ORDERS_Y + i * 52
      const g = this.add.graphics()
      g.fillStyle(0x1e3348, 0.92)
      g.fillRoundedRect(12, y, GAME.width - 24, 46, 12)
      g.lineStyle(1, 0xffd166, 0.35)
      g.strokeRoundedRect(12, y, GAME.width - 24, 46, 12)
      this.ordersLayer.add(g)

      let ox = 22
      order.needs.forEach((n) => {
        const def = ITEM_BY_ID[n.itemId]
        if (def && this.textures.exists(def.texture)) {
          const img = this.add.image(ox + 10, y + 22, def.texture)
          img.setDisplaySize(24, 24)
          this.ordersLayer.add(img)
        }
        const qty = this.add.text(ox + 24, y + 14, `×${n.qty}`, {
          fontFamily: FONT.body,
          fontSize: '11px',
          color: '#ffffff',
        })
        this.ordersLayer.add(qty)
        ox += 52
      })

      const starNote = mergeSave.data.ordersPlus ? `★${order.stars}×2` : `★${order.stars}`
      const rewards = this.add.text(22, y + 30, `+${order.coins}🪙 ${starNote}`, {
        fontFamily: FONT.body,
        fontSize: '10px',
        color: '#ffd166',
      })
      this.ordersLayer.add(rewards)

      const btn = createButton(this, {
        x: GAME.width - 60,
        y: y + 23,
        width: 78,
        height: 30,
        label: 'DELIVER',
        fill: COLORS.success,
        fontSize: 10,
        onClick: () => this.tryDeliver(i),
      })
      void btn
    })
  }

  private tryDeliver(index: number): void {
    const order = mergeSave.data.orders[index]
    if (!order) return
    for (const need of order.needs) {
      if (this.board.countItem(need.itemId) < need.qty) {
        audioSystem.play('warning')
        this.floatText(GAME.width / 2, ORDERS_Y, 'Need more items!', COLORS.warn)
        return
      }
    }
    for (const need of order.needs) this.board.consume(need.itemId, need.qty)
    const completed = mergeSave.completeOrder(index)
    this.persistBoard()
    audioSystem.play('coins')
    hapticsSystem.success()
    this.cameras.main.flash(140, 255, 209, 102)
    const stars = (completed?.stars ?? 0) * (mergeSave.data.ordersPlus ? 2 : 1)
    this.floatText(GAME.width / 2, ORDERS_Y - 20, `+${stars}★`, COLORS.gold)
    this.time.delayedCall(400, () => this.scene.restart())
  }

  private persistBoard(): void {
    mergeSave.data.board = this.board.serialize()
    mergeSave.persist()
  }

  private tickUi(): void {
    this.refreshHud()
    // Refresh hotspot colors if inventory changed
    for (const [id, mark] of this.hotspotMarks) {
      const hs = HOTSPOTS.find((h) => h.id === id)
      if (!hs || mergeSave.isHotspotDone(id)) continue
      const ready = mergeSave.hotspotReady(hs)
      const ring = mark.list[0] as Phaser.GameObjects.Arc
      const bang = mark.list[1] as Phaser.GameObjects.Text
      if (ring?.setFillStyle) ring.setFillStyle(ready.orange ? 0xff7a18 : 0xf5f5f5, 1)
      bang?.setColor(ready.orange ? '#ffffff' : '#334155')
    }
  }

  update(): void {
    void ENERGY_REGEN_MS
  }
}
