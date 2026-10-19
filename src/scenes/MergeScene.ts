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
import { Juice } from '../systems/merge/Juice'
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
  baseY: number
}

const SCENE_TOP = 46
const SCENE_VIEW_H = 200
const QUEST_Y = 258
const BOARD_TOP = 308
const TRAY_Y = 585
const ORDERS_Y = 658

export class MergeScene extends Phaser.Scene {
  private board!: BoardModel
  private juice!: Juice
  private tokens = new Map<string, TokenView>()
  private cellSize = 48
  private gridOriginX = 0
  private gridOriginY = 0
  private dragging: TokenView | null = null
  private dragOffset = { x: 0, y: 0 }
  private selected: TokenView | null = null
  private genReadyText: Phaser.GameObjects.Text[] = []
  private genRings: Phaser.GameObjects.Graphics[] = []
  private genCenters: { x: number; y: number; id: string }[] = []
  private hudCoins!: Phaser.GameObjects.Text
  private hudStars!: Phaser.GameObjects.Text
  private hudEnergy!: Phaser.GameObjects.Text
  private hudLevel!: Phaser.GameObjects.Text
  private highlight!: Phaser.GameObjects.Graphics
  private trayName!: Phaser.GameObjects.Text
  private trayHint!: Phaser.GameObjects.Text
  private questLabel!: Phaser.GameObjects.Text
  private questTicks!: Phaser.GameObjects.Text
  private questIcon!: Phaser.GameObjects.GameObject
  private sceneRoot!: Phaser.GameObjects.Container
  private parallaxLayer!: Phaser.GameObjects.Container
  private sceneScrollX = 0
  private hotspotMarks = new Map<string, Phaser.GameObjects.Container>()
  private speechRoot!: Phaser.GameObjects.Container
  private portraitImg!: Phaser.GameObjects.Image
  private speechText!: Phaser.GameObjects.Text
  private mergeStreak = 0
  private lastMergeAt = 0
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
    this.juice = new Juice(this)
    this.tokens.clear()
    this.genReadyText = []
    this.genRings = []
    this.genCenters = []
    this.selected = null
    this.dragging = null
    this.hotspotMarks.clear()
    this.sceneScrollX = 0
    this.mergeStreak = 0

    // Soft sky gradient backdrop
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x7ec8e3, 0x7ec8e3, 0xd4f0c8, 0xf7ffe8, 1)
    bg.fillRect(0, 0, GAME.width, GAME.height)

    this.cellSize = 48
    const gridW = this.board.cols * this.cellSize
    this.gridOriginX = (GAME.width - gridW) / 2 + this.cellSize / 2
    this.gridOriginY = BOARD_TOP + 38

    this.buildStoryScene()
    this.buildHud()
    this.buildQuestStrip()
    this.drawGrid()
    this.highlight = this.add.graphics().setDepth(5)
    this.rebuildTokens()
    this.buildGenerators()
    this.buildSelectionTray()
    this.buildOrders()
    this.buildSpeech()

    createButton(this, {
      x: 28,
      y: 22,
      width: 44,
      height: 32,
      label: '←',
      fill: 0xffffff,
      textColor: '#1a2744',
      fontSize: 16,
      onClick: () => {
        this.persistBoard()
        this.scene.start('Menu')
      },
    })
    createButton(this, {
      x: GAME.width - 48,
      y: 22,
      width: 72,
      height: 32,
      label: 'MAP ★',
      fill: COLORS.accent,
      fontSize: 12,
      onClick: () => {
        this.persistBoard()
        this.scene.start('Story')
      },
    })

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onDrag(p))
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onDrop(p))
    this.time.addEvent({ delay: 350, loop: true, callback: () => this.tickUi() })
  }

  private softCard(x: number, y: number, w: number, h: number, depth = 1): void {
    const g = this.add.graphics().setDepth(depth)
    g.fillStyle(0x000000, 0.1)
    g.fillRoundedRect(x + 2, y + 3, w, h, 16)
    g.fillStyle(0xffffff, 0.96)
    g.fillRoundedRect(x, y, w, h, 16)
    g.lineStyle(2, 0xffffff, 0.9)
    g.strokeRoundedRect(x, y, w, h, 16)
  }

  private buildHud(): void {
    this.softCard(68, 8, GAME.width - 148, 30, 40)
    this.hudCoins = this.add
      .text(80, 23, '', { fontFamily: FONT.display, fontSize: '12px', color: '#b45309', fontStyle: '800' })
      .setOrigin(0, 0.5)
      .setDepth(41)
    this.hudStars = this.add
      .text(150, 23, '', { fontFamily: FONT.display, fontSize: '12px', color: '#ca8a04', fontStyle: '800' })
      .setOrigin(0, 0.5)
      .setDepth(41)
    this.hudEnergy = this.add
      .text(210, 23, '', { fontFamily: FONT.body, fontSize: '11px', color: '#0369a1', fontStyle: '700' })
      .setOrigin(0, 0.5)
      .setDepth(41)
    this.hudLevel = this.add
      .text(GAME.width - 90, 23, '', {
        fontFamily: FONT.display,
        fontSize: '11px',
        color: '#1a2744',
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
    this.hudCoins?.setText(`🪙 ${d.coins}`)
    this.hudStars?.setText(`★ ${d.stars}`)
    const next = mergeSave.msToNextEnergy()
    const tip = d.energy >= max ? 'full' : `${Math.ceil(next / 1000)}s`
    this.hudEnergy?.setText(`⚡ ${d.energy}/${max} ${tip}`)
    this.hudLevel?.setText(`Lv ${d.level}`)
    this.refreshGenLabels()
  }

  private buildStoryScene(): void {
    const maskShape = this.make.graphics({ x: 0, y: 0 })
    maskShape.fillStyle(0xffffff)
    maskShape.fillRoundedRect(10, SCENE_TOP, GAME.width - 20, SCENE_VIEW_H, 18)
    const mask = maskShape.createGeometryMask()

    // Card frame under scene
    this.softCard(10, SCENE_TOP, GAME.width - 20, SCENE_VIEW_H, 1)

    this.sceneRoot = this.add.container(0, SCENE_TOP).setDepth(2)
    this.sceneRoot.setMask(mask)
    this.parallaxLayer = this.add.container(0, 0)
    this.sceneRoot.add(this.parallaxLayer)

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
      const maxScroll = Math.max(0, SCENE_WIDTH - (GAME.width - 20))
      this.sceneScrollX = Phaser.Math.Clamp(scrollStart - (p.x - pointerStart), 0, maxScroll)
      this.sceneRoot.x = 10 - this.sceneScrollX
      this.parallaxLayer.x = this.sceneScrollX * 0.12
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
    }

    // Ambient sparkles / light motes
    for (let i = 0; i < 10; i++) {
      const mote = this.add.circle(
        Phaser.Math.Between(20, SCENE_WIDTH - 20),
        Phaser.Math.Between(20, SCENE_HEIGHT - 20),
        Phaser.Math.Between(2, 4),
        0xffffff,
        0.55,
      )
      this.parallaxLayer.add(mote)
      this.tweens.add({
        targets: mote,
        y: mote.y - Phaser.Math.Between(12, 28),
        alpha: 0.15,
        duration: 1800 + Math.random() * 1200,
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 1000,
        ease: 'Sine.inOut',
      })
    }

    this.add
      .text(GAME.width / 2, SCENE_TOP + SCENE_VIEW_H - 12, '⟷ drag  ·  tap orange ! ', {
        fontFamily: FONT.body,
        fontSize: '10px',
        color: '#1a2744',
        fontStyle: '700',
        backgroundColor: '#ffffffaa',
        padding: { x: 8, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(4)

    for (const hs of HOTSPOTS) this.spawnHotspotMark(hs)
    this.sceneRoot.x = 10
  }

  private spawnHotspotMark(hs: HavenHotspot): void {
    const done = mergeSave.isHotspotDone(hs.id)
    const areaOpen = mergeSave.data.unlockedStory.includes(hs.areaId)
    if (!areaOpen && !done) return

    const mark = this.add.container(hs.x, hs.y)
    const ready = mergeSave.hotspotReady(hs)
    const color = done ? 0x22c55e : ready.orange ? 0xff7a18 : 0xcbd5e1
    const glow = this.add.circle(0, 0, 22, color, ready.orange ? 0.35 : 0.15)
    const ring = this.add.circle(0, 0, 17, color, 1)
    ring.setStrokeStyle(3, 0xffffff, 0.95)
    const bang = this.add
      .text(0, -1, done ? '✓' : '!', {
        fontFamily: FONT.display,
        fontSize: done ? '16px' : '22px',
        color: '#ffffff',
        fontStyle: '900',
      })
      .setOrigin(0.5)

    const needDef = ITEM_BY_ID[hs.needItemId]
    const needLabel = this.add
      .text(0, 26, done ? 'Done' : ready.orange ? 'Tap / use' : `need ${needDef?.name ?? '?'}`, {
        fontFamily: FONT.body,
        fontSize: '9px',
        color: '#1a2744',
        fontStyle: '800',
        backgroundColor: '#ffffffee',
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0.5)

    mark.add([glow, ring, bang, needLabel])
    mark.setSize(40, 40)
    mark.setInteractive(new Phaser.Geom.Circle(0, 0, 20), Phaser.Geom.Circle.Contains)
    mark.on('pointerdown', () => this.juice.press(mark))
    mark.on('pointerup', () => this.onHotspotTap(hs))

    if (ready.orange && !done) {
      this.tweens.add({
        targets: [glow, ring],
        scale: 1.18,
        duration: 480,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      })
    }
    if (!done) {
      mark.setScale(0)
      this.tweens.add({ targets: mark, scale: 1, duration: 360, ease: 'Back.out', delay: 80 })
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
      this.showSpeech(hs)
      return
    }
    const ready = mergeSave.hotspotReady(hs)
    if (!ready.orange) {
      audioSystem.play('warning')
      hapticsSystem.warn()
      const def = ITEM_BY_ID[hs.needItemId]
      this.juice.floatText(
        GAME.width / 2,
        QUEST_Y - 6,
        ready.reason === 'Need more ★' ? `Need ★${hs.starCost}` : `Need ${def?.name ?? 'item'}`,
        '#ff7a18',
      )
      this.refreshQuestStrip()
      return
    }

    let token = this.selected && this.selected.itemId === hs.needItemId ? this.selected : null
    if (!token) token = [...this.tokens.values()].find((t) => t.itemId === hs.needItemId) ?? null
    if (!token) {
      this.juice.floatText(GAME.width / 2, QUEST_Y - 6, 'Craft it on the board', '#ff7a18')
      return
    }
    this.selectToken(token)

    const mark = this.hotspotMarks.get(hs.id)
    const worldX = (mark?.x ?? hs.x) + this.sceneRoot.x
    const worldY = (mark?.y ?? hs.y) + SCENE_TOP
    const def = ITEM_BY_ID[token.itemId]
    const fromX = token.container.x
    const fromY = token.container.y
    const uid = token.uid

    // Hide token during fly
    token.container.setVisible(false)
    this.juice.flyTo(fromX, fromY, worldX, worldY, def?.texture ?? null, def?.color ?? 0xffd166, () => {
      const res = mergeSave.completeHotspot(hs, uid)
      if (!res.ok) {
        token!.container.setVisible(true)
        this.juice.floatText(GAME.width / 2, QUEST_Y - 6, res.reason ?? 'Fail', '#ff4d6d')
        return
      }
      token!.container.destroy(true)
      this.tokens.delete(uid)
      if (this.selected?.uid === uid) this.selected = null
      this.board = new BoardModel(mergeSave.data.board)
      this.updateTray()
      this.refreshHotspots()
      this.refreshQuestStrip()
      this.refreshHud()
      this.cameras.main.flash(140, 255, 220, 140)
      this.showSpeech(hs)
      this.juice.starsBurst(worldX, worldY)
      this.juice.floatText(GAME.width / 2, SCENE_TOP + 36, `+${hs.rewardStars}★ restored!`, '#ca8a04', 18)
    })
  }

  private buildSpeech(): void {
    this.speechRoot = this.add.container(GAME.width / 2, SCENE_TOP + 52).setDepth(55).setAlpha(0)
    const card = this.add.graphics()
    card.fillStyle(0x000000, 0.12)
    card.fillRoundedRect(-168, -34, 336, 68, 18)
    card.fillStyle(0xfffdf8, 0.98)
    card.fillRoundedRect(-170, -36, 336, 68, 18)
    card.lineStyle(3, 0xffc93c, 0.85)
    card.strokeRoundedRect(-170, -36, 336, 68, 18)

    this.portraitImg = this.add.image(-132, 0, 'portrait_mira')
    this.portraitImg.setDisplaySize(52, 52)
    const eye = this.add.rectangle(-132, -4, 18, 6, 0x1a2744, 0.001)
    this.juice.portraitBlink(eye)

    this.speechText = this.add
      .text(-96, 0, '', {
        fontFamily: FONT.body,
        fontSize: '11px',
        color: '#1a2744',
        fontStyle: '700',
        wordWrap: { width: 240 },
      })
      .setOrigin(0, 0.5)

    this.speechRoot.add([card, this.portraitImg, eye, this.speechText])
  }

  private showSpeech(hs: HavenHotspot): void {
    const key = `portrait_${hs.portrait}`
    if (this.textures.exists(key)) this.portraitImg.setTexture(key)
    this.speechText.setText(`${hs.character}: “${hs.line}”`)
    this.speechRoot.setAlpha(1).setScale(0.85)
    this.juice.portraitTalk(this.portraitImg)
    this.tweens.killTweensOf(this.speechRoot)
    this.tweens.add({ targets: this.speechRoot, scale: 1, duration: 200, ease: 'Back.out' })
    this.tweens.add({ targets: this.speechRoot, alpha: 0, delay: 3000, duration: 350 })
  }

  private buildQuestStrip(): void {
    this.softCard(10, QUEST_Y - 24, GAME.width - 20, 48, 2)
    this.add
      .text(22, QUEST_Y - 10, 'QUEST', {
        fontFamily: FONT.display,
        fontSize: '10px',
        color: '#ea580c',
        fontStyle: '900',
      })
      .setOrigin(0, 0.5)
      .setDepth(3)

    this.questLabel = this.add
      .text(68, QUEST_Y - 12, '', {
        fontFamily: FONT.body,
        fontSize: '12px',
        color: '#1a2744',
        fontStyle: '800',
      })
      .setOrigin(0, 0.5)
      .setDepth(3)

    this.questTicks = this.add
      .text(68, QUEST_Y + 6, '', {
        fontFamily: FONT.body,
        fontSize: '10px',
        color: '#64748b',
        fontStyle: '700',
      })
      .setOrigin(0, 0.5)
      .setDepth(3)

    this.questIcon = this.add.text(GAME.width - 36, QUEST_Y - 2, '?', { fontSize: '22px' }).setOrigin(0.5).setDepth(3)
    this.refreshQuestStrip()
  }

  private refreshQuestStrip(): void {
    const q = nextQuest(mergeSave.data.completedHotspots, mergeSave.data.unlockedStory)
    const done = mergeSave.data.completedHotspots.length
    const total = HOTSPOTS.filter((h) => mergeSave.data.unlockedStory.includes(h.areaId)).length || HOTSPOTS.length
    this.questTicks.setText(`Progress  ${'●'.repeat(Math.min(done, 6))}${'○'.repeat(Math.max(0, Math.min(6, total) - Math.min(done, 6)))}  ${done}/${total}`)

    if (!q) {
      this.questLabel.setText('Open MAP ★ — restore a new area')
      return
    }
    const def = ITEM_BY_ID[q.needItemId]
    const have = this.board.countItem(q.needItemId)
    const starBit = q.starCost > 0 ? ` · ★${q.starCost}` : ''
    this.questLabel.setText(`${def?.name ?? '?'} → ${q.title}${starBit}  (${have}/1)`)
    if (def && this.textures.exists(def.texture)) {
      if (this.questIcon instanceof Phaser.GameObjects.Text) {
        this.questIcon.destroy()
        const img = this.add.image(GAME.width - 36, QUEST_Y - 2, def.texture).setDepth(3)
        img.setDisplaySize(34, 34)
        this.questIcon = img
      } else if (this.questIcon instanceof Phaser.GameObjects.Image) {
        this.questIcon.setTexture(def.texture)
        this.questIcon.setDisplaySize(34, 34)
      }
    }
  }

  private drawGrid(): void {
    if (this.gridGfx) this.gridGfx.destroy()
    this.gridGfx = this.add.graphics().setDepth(1)
    // Board card
    const pad = 8
    const bw = this.board.cols * this.cellSize + pad * 2
    const bh = this.board.rows * this.cellSize + pad * 2
    const bx = this.gridOriginX - this.cellSize / 2 - pad
    const by = this.gridOriginY - this.cellSize / 2 - pad
    this.gridGfx.fillStyle(0x000000, 0.1)
    this.gridGfx.fillRoundedRect(bx + 2, by + 3, bw, bh, 18)
    this.gridGfx.fillStyle(0xf0f7ff, 0.95)
    this.gridGfx.fillRoundedRect(bx, by, bw, bh, 18)

    const level = mergeSave.data.level
    for (let y = 0; y < this.board.rows; y++) {
      for (let x = 0; x < this.board.cols; x++) {
        const cx = this.gridOriginX + x * this.cellSize
        const cy = this.gridOriginY + y * this.cellSize
        const open = this.board.isUnlocked(x, y, level)
        if (open) {
          this.gridGfx.fillStyle(0xffffff, 0.95)
          this.gridGfx.fillRoundedRect(cx - 21, cy - 21, 42, 42, 12)
          this.gridGfx.lineStyle(2, 0xd6e4f0, 1)
          this.gridGfx.strokeRoundedRect(cx - 21, cy - 21, 42, 42, 12)
        } else {
          this.gridGfx.fillStyle(0x94a3b8, 0.55)
          this.gridGfx.fillRoundedRect(cx - 21, cy - 21, 42, 42, 12)
          this.gridGfx.lineStyle(2, 0xffffff, 0.35)
          for (let i = -12; i <= 12; i += 6) {
            this.gridGfx.lineBetween(cx + i, cy - 14, cx + i, cy + 14)
          }
          this.add
            .text(cx, cy, `Lv${cellUnlockLevel(x, y)}`, {
              fontFamily: FONT.display,
              fontSize: '10px',
              color: '#fff7ed',
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

    const shadow = this.add.ellipse(0, 16, 30, 10, 0x000000, 0.2)
    let art: Phaser.GameObjects.GameObject
    if (this.textures.exists(def.texture)) {
      const img = this.add.image(0, 0, def.texture)
      img.setDisplaySize(40, 40)
      art = img
    } else {
      const body = this.add.graphics()
      body.fillStyle(def.color, 1)
      body.fillRoundedRect(-18, -18, 36, 36, 10)
      art = this.add.container(0, 0, [body, this.add.text(0, 0, def.emoji, { fontSize: '20px' }).setOrigin(0.5)])
    }
    const tier = this.add
      .text(14, 14, `${def.tier}`, {
        fontFamily: FONT.body,
        fontSize: '10px',
        color: '#1a2744',
        fontStyle: '800',
        backgroundColor: '#ffc93c',
        padding: { x: 3, y: 0 },
      })
      .setOrigin(0.5)

    const container = this.add.container(pos.x, pos.y, [shadow, art, tier]).setSize(42, 42)
    container.setDepth(10)
    container.setInteractive(new Phaser.Geom.Rectangle(-21, -21, 42, 42), Phaser.Geom.Rectangle.Contains)
    this.juice.shineSweep(container, 18, 18)

    const view: TokenView = { uid, itemId, gx, gy, container, baseY: pos.y }
    this.tokens.set(uid, view)
    this.juice.idleFloat(container, pos.y, Math.random() * 400)

    container.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.dragging) return
      this.selectToken(view)
      this.dragging = view
      this.dragOffset = { x: container.x - p.x, y: container.y - p.y }
      container.setDepth(30)
      this.tweens.killTweensOf(container)
      this.tweens.add({ targets: container, scale: 1.16, duration: 70, ease: 'Back.out' })
      audioSystem.play('click')
      hapticsSystem.tap()
    })

    if (pop) {
      container.setScale(0.1)
      this.tweens.add({ targets: container, scale: 1, duration: 280, ease: 'Back.out' })
    }
  }

  private selectToken(view: TokenView): void {
    this.selected = view
    this.updateTray()
  }

  private buildSelectionTray(): void {
    this.softCard(12, TRAY_Y, GAME.width - 24, 56, 2)
    const accent = this.add.graphics().setDepth(3)
    accent.lineStyle(3, 0xffc93c, 1)
    accent.strokeRoundedRect(12, TRAY_Y, GAME.width - 24, 56, 16)

    this.trayName = this.add
      .text(28, TRAY_Y + 18, 'Tap an item', {
        fontFamily: FONT.display,
        fontSize: '14px',
        color: '#1a2744',
        fontStyle: '800',
      })
      .setOrigin(0, 0.5)
      .setDepth(3)
    this.trayHint = this.add
      .text(28, TRAY_Y + 38, 'Merge matches · fly crafted pieces onto orange !', {
        fontFamily: FONT.body,
        fontSize: '11px',
        color: '#64748b',
        fontStyle: '700',
      })
      .setOrigin(0, 0.5)
      .setDepth(3)
  }

  private updateTray(): void {
    if (!this.selected) {
      this.trayName.setText('Tap an item')
      this.trayHint.setText('Merge matches · fly crafted pieces onto orange !')
      return
    }
    const def = ITEM_BY_ID[this.selected.itemId]
    const q = nextQuest(mergeSave.data.completedHotspots, mergeSave.data.unlockedStory)
    this.trayName.setText(def ? `${def.name}  ·  Tier ${def.tier}` : this.selected.itemId)
    if (q && q.needItemId === this.selected.itemId) {
      this.trayHint.setText(`Ready! Tap the orange ! — ${q.title}`)
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
      this.highlight.lineStyle(4, !open ? 0x94a3b8 : canMerge ? 0x22c55e : 0xffc93c, 1)
      this.highlight.strokeRoundedRect(c.x - 24, c.y - 24, 48, 48, 12)
      // Magnet pull preview
      if (canMerge) {
        this.dragging.container.x += (c.x - this.dragging.container.x) * 0.12
        this.dragging.container.y += (c.y - this.dragging.container.y) * 0.12
      }
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
      this.juice.floatText(GAME.width / 2, BOARD_TOP, `Unlocks at Lv${cellUnlockLevel(cell.x, cell.y)}`, '#ff7a18')
      this.snapToken(view)
      return
    }

    const target = this.board.get(cell.x, cell.y)
    if (target && target.uid !== view.uid && target.itemId === view.itemId) {
      // Magnet snap into target then merge
      const c = this.cellCenter(cell.x, cell.y)
      this.tweens.add({
        targets: view.container,
        x: c.x,
        y: c.y,
        duration: 90,
        ease: 'Back.in',
        onComplete: () => this.finishMerge(view, cell.x, cell.y, target.uid),
      })
      return
    }

    if (!target) {
      if (this.board.tryMove(view.gx, view.gy, cell.x, cell.y, level)) {
        view.gx = cell.x
        view.gy = cell.y
        view.baseY = this.cellCenter(cell.x, cell.y).y
        this.snapToken(view)
        this.persistBoard()
        return
      }
    }
    this.snapToken(view)
  }

  private finishMerge(view: TokenView, tx: number, ty: number, targetUid: string): void {
    const level = mergeSave.data.level
    const result = this.board.tryMerge(view.gx, view.gy, tx, ty, level)
    if (!result) {
      this.snapToken(view)
      return
    }
    const other = this.tokens.get(targetUid)
    view.container.destroy(true)
    other?.container.destroy(true)
    this.tokens.delete(view.uid)
    this.tokens.delete(targetUid)

    const now = Date.now()
    this.mergeStreak = now - this.lastMergeAt < 2200 ? this.mergeStreak + 1 : 1
    this.lastMergeAt = now

    this.spawnTokenView(result.item.uid, result.item.itemId, result.x, result.y, true)
    this.selected = this.tokens.get(result.item.uid) ?? null
    mergeSave.data.totalMerges += 1
    const c = this.cellCenter(result.x, result.y)
    this.juice.mergePop(c.x, c.y, result.def.color, this.mergeStreak)
    this.persistBoard()
    this.refreshHud()
    this.refreshHotspots()
    this.refreshQuestStrip()
    this.updateTray()
    if (mergeSave.addXp(2)) {
      this.juice.floatText(GAME.width / 2, BOARD_TOP, 'LEVEL UP! Board expands', '#ffc93c', 20)
      this.time.delayedCall(450, () => this.scene.restart())
    }
    const q = nextQuest(mergeSave.data.completedHotspots, mergeSave.data.unlockedStory)
    if (q && result.item.itemId === q.needItemId) {
      this.juice.floatText(GAME.width / 2, QUEST_Y - 28, 'Quest ready — tap orange !', '#ea580c')
    }
  }

  private snapToken(view: TokenView): void {
    const c = this.cellCenter(view.gx, view.gy)
    view.baseY = c.y
    this.tweens.add({
      targets: view.container,
      x: c.x,
      y: c.y,
      duration: 120,
      ease: 'Back.out',
      onComplete: () => this.juice.idleFloat(view.container, c.y),
    })
  }

  private buildGenerators(): void {
    const unlocked = GENERATORS.filter((g) => mergeSave.isGeneratorUnlocked(g.id))
    const locked = GENERATORS.filter((g) => !mergeSave.isGeneratorUnlocked(g.id))
    const shown = [...unlocked, ...locked]

    shown.forEach((gen, i) => {
      const x = 78 + i * 140
      const y = BOARD_TOP
      const open = mergeSave.isGeneratorUnlocked(gen.id)

      const card = this.add.graphics().setDepth(3)
      card.fillStyle(0x000000, 0.1)
      card.fillRoundedRect(x - 60, y - 18, 120, 38, 14)
      card.fillStyle(open ? 0xecfdf5 : 0xe2e8f0, 0.98)
      card.fillRoundedRect(x - 62, y - 20, 120, 38, 14)
      card.lineStyle(2, open ? 0x22c55e : 0x94a3b8, 0.85)
      card.strokeRoundedRect(x - 62, y - 20, 120, 38, 14)

      const ring = this.add.graphics().setDepth(4)
      this.genRings[i] = ring
      this.genCenters.push({ x, y, id: gen.id })

      this.add
        .text(x - 44, y, open ? '⚡' : '🔒', { fontSize: '15px' })
        .setOrigin(0.5)
        .setDepth(4)

      this.add
        .text(x + 10, y - 6, gen.name, {
          fontFamily: FONT.display,
          fontSize: '11px',
          color: '#1a2744',
          fontStyle: '800',
        })
        .setOrigin(0.5)
        .setDepth(4)

      const ready = this.add
        .text(x + 10, y + 8, '', {
          fontFamily: FONT.body,
          fontSize: '10px',
          color: open ? '#15803d' : '#64748b',
          fontStyle: '700',
        })
        .setOrigin(0.5)
        .setDepth(4)
      this.genReadyText[i] = ready
      ;(ready as Phaser.GameObjects.Text & { genId?: string }).genId = gen.id

      const hit = this.add
        .rectangle(x, y, 120, 38, 0x000000, 0.001)
        .setDepth(5)
        .setInteractive({ useHandCursor: true })
      hit.on('pointerdown', () => this.juice.press(hit))
      hit.on('pointerup', () => {
        if (!open) {
          this.juice.floatText(GAME.width / 2, BOARD_TOP - 20, 'Restore on MAP ★ first', '#ca8a04')
          audioSystem.play('warning')
          return
        }
        this.tapGenerator(gen, x, y)
      })
    })
    this.refreshGenLabels()
  }

  private refreshGenLabels(): void {
    this.genReadyText.forEach((label, i) => {
      const genId = (label as Phaser.GameObjects.Text & { genId?: string }).genId
      const gen = GENERATORS.find((g) => g.id === genId)
      if (!gen || !label) return
      const ring = this.genRings[i]
      const center = this.genCenters[i]
      if (!mergeSave.isGeneratorUnlocked(gen.id)) {
        label.setText('MAP unlock')
        ring?.clear()
        return
      }
      const readyAt = mergeSave.data.generatorReadyAt[gen.id] ?? 0
      const left = Math.max(0, readyAt - Date.now())
      const total = gen.cooldownMs
      const progress = left > 0 ? 1 - left / total : 1
      if (ring && center) {
        ring.clear()
        ring.lineStyle(3, 0xe2e8f0, 1)
        ring.beginPath()
        ring.arc(center.x - 44, center.y, 10, 0, Math.PI * 2)
        ring.strokePath()
        ring.lineStyle(3, left > 0 ? 0x38bdf8 : 0x22c55e, 1)
        ring.beginPath()
        ring.arc(center.x - 44, center.y, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress)
        ring.strokePath()
      }
      if (left > 0) label.setText(`${Math.ceil(left / 1000)}s · ${gen.energyCost}⚡`)
      else label.setText(`TAP · ${gen.energyCost}⚡`)
    })
  }

  private tapGenerator(gen: GeneratorDef, gx: number, gy: number): void {
    const readyAt = mergeSave.data.generatorReadyAt[gen.id] ?? 0
    if (Date.now() < readyAt) {
      this.juice.floatText(GAME.width / 2, BOARD_TOP - 20, 'Charging…', '#38bdf8')
      return
    }
    if (!mergeSave.spendEnergy(gen.energyCost)) {
      audioSystem.play('warning')
      hapticsSystem.warn()
      this.juice.floatText(GAME.width / 2, BOARD_TOP - 20, 'Out of energy!', '#ff4d6d')
      this.offerEnergyRefill()
      return
    }
    const level = mergeSave.data.level
    const empty = this.board.findEmpty(level)
    if (!empty) {
      mergeSave.data.energy = Math.min(mergeSave.maxEnergy(), mergeSave.data.energy + gen.energyCost)
      mergeSave.persist()
      this.juice.floatText(GAME.width / 2, BOARD_TOP - 20, 'Board full!', '#ff7a18')
      this.refreshHud()
      return
    }

    const itemId = this.rollOutput(gen)
    const def = ITEM_BY_ID[itemId]
    const spawned = this.board.spawn(itemId, level, empty)
    if (!spawned) return
    mergeSave.data.generatorReadyAt[gen.id] = Date.now() + gen.cooldownMs
    const dest = this.cellCenter(spawned.x, spawned.y)
    this.juice.spawnArc(gx, gy, dest.x, dest.y, def?.texture ?? '', () => {
      this.spawnTokenView(spawned.item.uid, spawned.item.itemId, spawned.x, spawned.y, true)
      this.juice.burst(dest.x, dest.y, def?.color ?? 0x22c55e, 10)
    })
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
          this.juice.floatText(GAME.width / 2, BOARD_TOP, 'Energy full!', '#22c55e')
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
      textColor: '#1a2744',
      fontSize: 12,
      onClick: () => {
        if (mergeSave.spendCoins(40)) {
          mergeSave.refillEnergyFull()
          this.juice.floatText(GAME.width / 2, BOARD_TOP, 'Energy full!', '#22c55e')
          this.refreshHud()
        }
      },
    })
  }

  private buildOrders(): void {
    if (this.ordersLayer) this.ordersLayer.destroy(true)
    this.ordersLayer = this.add.container(0, 0).setDepth(3)

    const title = this.add.text(18, ORDERS_Y - 16, 'ORDERS → ★', {
      fontFamily: FONT.display,
      fontSize: '11px',
      color: '#b45309',
      fontStyle: '900',
    })
    this.ordersLayer.add(title)

    mergeSave.data.orders.slice(0, 2).forEach((order, i) => {
      const y = ORDERS_Y + i * 52
      const g = this.add.graphics()
      g.fillStyle(0x000000, 0.08)
      g.fillRoundedRect(14, y + 2, GAME.width - 28, 46, 14)
      g.fillStyle(0xffffff, 0.96)
      g.fillRoundedRect(12, y, GAME.width - 24, 46, 14)
      g.lineStyle(2, 0xffe08a, 0.9)
      g.strokeRoundedRect(12, y, GAME.width - 24, 46, 14)
      this.ordersLayer.add(g)

      let ox = 22
      order.needs.forEach((n) => {
        const def = ITEM_BY_ID[n.itemId]
        const have = this.board.countItem(n.itemId)
        if (def && this.textures.exists(def.texture)) {
          const img = this.add.image(ox + 10, y + 22, def.texture)
          img.setDisplaySize(26, 26)
          this.ordersLayer.add(img)
        }
        const tick = have >= n.qty ? '✓' : `${have}/${n.qty}`
        const qty = this.add.text(ox + 24, y + 14, tick, {
          fontFamily: FONT.body,
          fontSize: '11px',
          color: have >= n.qty ? '#16a34a' : '#1a2744',
          fontStyle: '800',
        })
        this.ordersLayer.add(qty)
        ox += 56
      })

      const starNote = mergeSave.data.ordersPlus ? `★${order.stars}×2` : `★${order.stars}`
      const rewards = this.add.text(22, y + 30, `+${order.coins}🪙  ${starNote}`, {
        fontFamily: FONT.body,
        fontSize: '10px',
        color: '#b45309',
        fontStyle: '700',
      })
      this.ordersLayer.add(rewards)

      createButton(this, {
        x: GAME.width - 60,
        y: y + 23,
        width: 78,
        height: 30,
        label: 'CLAIM',
        fill: COLORS.success,
        fontSize: 11,
        onClick: () => this.tryDeliver(i),
      })
    })
  }

  private tryDeliver(index: number): void {
    const order = mergeSave.data.orders[index]
    if (!order) return
    for (const need of order.needs) {
      if (this.board.countItem(need.itemId) < need.qty) {
        audioSystem.play('warning')
        this.juice.floatText(GAME.width / 2, ORDERS_Y, 'Need more items!', '#ff7a18')
        return
      }
    }
    for (const need of order.needs) this.board.consume(need.itemId, need.qty)
    const completed = mergeSave.completeOrder(index)
    this.persistBoard()
    const stars = (completed?.stars ?? 0) * (mergeSave.data.ordersPlus ? 2 : 1)
    this.juice.starsBurst(GAME.width / 2, ORDERS_Y + 20)
    this.juice.floatText(GAME.width / 2, ORDERS_Y - 10, `+${stars}★`, '#ca8a04', 22)
    this.cameras.main.flash(120, 255, 230, 150)
    this.time.delayedCall(420, () => this.scene.restart())
  }

  private persistBoard(): void {
    mergeSave.data.board = this.board.serialize()
    mergeSave.persist()
  }

  private tickUi(): void {
    this.refreshHud()
    this.refreshQuestStrip()
    for (const [id, mark] of this.hotspotMarks) {
      const hs = HOTSPOTS.find((h) => h.id === id)
      if (!hs || mergeSave.isHotspotDone(id)) continue
      const ready = mergeSave.hotspotReady(hs)
      const glow = mark.list[0] as Phaser.GameObjects.Arc
      const ring = mark.list[1] as Phaser.GameObjects.Arc
      const color = ready.orange ? 0xff7a18 : 0xcbd5e1
      glow?.setFillStyle?.(color, ready.orange ? 0.35 : 0.15)
      ring?.setFillStyle?.(color, 1)
    }
  }

  update(): void {
    void ENERGY_REGEN_MS
  }
}
