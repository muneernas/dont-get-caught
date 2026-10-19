import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import {
  ENERGY_REGEN_MS,
  GENERATORS,
  ITEM_BY_ID,
  type GeneratorDef,
} from '../data/merge/items'
import { nextQuest } from '../data/merge/quests'
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

const ORDER_CHARS = ['mira', 'theo', 'lina'] as const

/** Colorful commercial board layout (reference-matched). */
const TOP_Y = 8
const ORDERS_Y = 58
const GRID_TOP = 205
const BOTTOM_Y = 725

export class MergeScene extends Phaser.Scene {
  private board!: BoardModel
  private juice!: Juice
  private tokens = new Map<string, TokenView>()
  private cellSize = 46
  private gridOriginX = 0
  private gridOriginY = 0
  private dragging: TokenView | null = null
  private dragOffset = { x: 0, y: 0 }
  private selected: TokenView | null = null
  private highlight!: Phaser.GameObjects.Graphics
  private gridGfx!: Phaser.GameObjects.Graphics
  private orderNeedIds = new Set<string>()
  private trayName!: Phaser.GameObjects.Text
  private trayHint!: Phaser.GameObjects.Text
  private hudEnergy!: Phaser.GameObjects.Text
  private hudCoins!: Phaser.GameObjects.Text
  private hudStars!: Phaser.GameObjects.Text
  private genReadyText: Phaser.GameObjects.Text[] = []
  private genRings: Phaser.GameObjects.Graphics[] = []
  private genCenters: { x: number; y: number; id: string }[] = []
  private mergeStreak = 0
  private lastMergeAt = 0
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
    this.selected = null
    this.dragging = null
    this.mergeStreak = 0
    this.genReadyText = []
    this.genRings = []
    this.genCenters = []
    this.refreshOrderNeeds()

    // Warm colorful backdrop (not bland beige void)
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x5ec8e8, 0x5ec8e8, 0xffb86b, 0xff8fab, 1)
    bg.fillRect(0, 0, GAME.width, GAME.height)
    // playful blobs
    for (let i = 0; i < 8; i++) {
      const orb = this.add.circle(
        Phaser.Math.Between(20, GAME.width - 20),
        Phaser.Math.Between(40, GAME.height - 40),
        Phaser.Math.Between(18, 40),
        [0xff6bcb, 0xffd93d, 0x6bcBff, 0x7dffb3][i % 4]!,
        0.12,
      )
      this.tweens.add({
        targets: orb,
        y: orb.y + Phaser.Math.Between(-20, 20),
        duration: 2800 + i * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      })
    }

    this.cellSize = 46
    const gridW = this.board.cols * this.cellSize
    this.gridOriginX = (GAME.width - gridW) / 2 + this.cellSize / 2
    this.gridOriginY = GRID_TOP + this.cellSize / 2 + 6

    this.buildTopBar()
    this.buildOrderRow()
    this.buildEventChips()
    this.drawGrid()
    this.highlight = this.add.graphics().setDepth(8)
    this.rebuildTokens()
    this.buildOnBoardGenerators()
    this.buildBottomBar()

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onDrag(p))
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onDrop(p))
    this.time.addEvent({ delay: 400, loop: true, callback: () => this.refreshHud() })
  }

  private refreshOrderNeeds(): void {
    this.orderNeedIds.clear()
    for (const o of mergeSave.data.orders) {
      for (const n of o.needs) this.orderNeedIds.add(n.itemId)
    }
  }

  private buildTopBar(): void {
    // Avatar + level
    const ax = 36
    const ay = TOP_Y + 28
    const ring = this.add.graphics().setDepth(20)
    ring.fillStyle(0xffffff, 1)
    ring.fillCircle(ax, ay, 26)
    ring.lineStyle(3, 0xf59e0b, 1)
    ring.strokeCircle(ax, ay, 26)
    if (this.textures.exists('ui_avatar')) {
      const av = this.add.image(ax, ay, 'ui_avatar').setDepth(21)
      av.setDisplaySize(48, 48)
    } else if (this.textures.exists('portrait_mira')) {
      this.add.image(ax, ay, 'portrait_mira').setDisplaySize(48, 48).setDepth(21)
    }
    const lvlBg = this.add.graphics().setDepth(22)
    lvlBg.fillStyle(0xb45309, 1)
    lvlBg.fillRoundedRect(ax - 14, ay + 14, 28, 16, 8)
    this.add
      .text(ax, ay + 22, `${mergeSave.data.level}`, {
        fontFamily: FONT.display,
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: '900',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(23)

    // Resource pills
    this.hudEnergy = this.makePill(100, ay, 0xf5e6c8, '⚡', '100', 0x3b82f6)
    this.hudCoins = this.makePill(210, ay, 0xf5e6c8, '💎', '40', 0xa855f7)
    this.hudStars = this.makePill(300, ay, 0xf5e6c8, '★', '5', 0xf59e0b)

    // Shop cart
    createButton(this, {
      x: GAME.width - 28,
      y: ay,
      width: 40,
      height: 40,
      label: '🛒',
      fill: 0x22c55e,
      fontSize: 18,
      onClick: () => {
        this.persistBoard()
        this.scene.start('Shop')
      },
    })

    // Back (small)
    createButton(this, {
      x: GAME.width - 28,
      y: ay + 44,
      width: 40,
      height: 28,
      label: 'MAP',
      fill: 0xff7a33,
      fontSize: 10,
      onClick: () => {
        this.persistBoard()
        this.scene.start('Story')
      },
    })

    this.refreshHud()
  }

  private makePill(
    x: number,
    y: number,
    fill: number,
    icon: string,
    _val: string,
    iconColor: number,
  ): Phaser.GameObjects.Text {
    const g = this.add.graphics().setDepth(20)
    g.fillStyle(0x000000, 0.15)
    g.fillRoundedRect(x - 42, y - 14 + 2, 84, 28, 14)
    g.fillStyle(fill, 1)
    g.fillRoundedRect(x - 42, y - 14, 84, 28, 14)
    g.lineStyle(3, 0xffffff, 1)
    g.strokeRoundedRect(x - 42, y - 14, 84, 28, 14)
    // icon disc
    g.fillStyle(iconColor, 1)
    g.fillCircle(x - 28, y, 11)
    this.add
      .text(x - 28, y, icon, { fontSize: '12px' })
      .setOrigin(0.5)
      .setDepth(21)
    // + button
    g.fillStyle(0x22c55e, 1)
    g.fillCircle(x + 30, y, 9)
    this.add
      .text(x + 30, y, '+', {
        fontFamily: FONT.display,
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: '900',
      })
      .setOrigin(0.5)
      .setDepth(21)

    return this.add
      .text(x + 2, y, '', {
        fontFamily: FONT.display,
        fontSize: '13px',
        color: '#ffffff',
        fontStyle: '900',
        stroke: '#3b2a14',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(21)
  }

  private refreshHud(): void {
    mergeSave.regenEnergy()
    const d = mergeSave.data
    this.hudEnergy?.setText(`${d.energy}`)
    this.hudCoins?.setText(`${d.coins}`)
    this.hudStars?.setText(`${d.stars}`)
    this.refreshGenLabels()
  }

  private buildOrderRow(): void {
    if (this.ordersLayer) this.ordersLayer.destroy(true)
    this.ordersLayer = this.add.container(0, 0).setDepth(15)

    const orders = mergeSave.data.orders.slice(0, 3)
    const cardW = 112
    const gap = 8
    const total = orders.length * cardW + (orders.length - 1) * gap
    let x0 = (GAME.width - total) / 2 + cardW / 2

    orders.forEach((order, i) => {
      const x = x0 + i * (cardW + gap)
      const y = ORDERS_Y + 55
      const char = ORDER_CHARS[i % ORDER_CHARS.length]!

      // Portrait peeking over card
      const pKey = `portrait_${char}`
      if (this.textures.exists(pKey)) {
        const p = this.add.image(x, y - 52, pKey)
        p.setDisplaySize(56, 56)
        this.ordersLayer.add(p)
      }

      // Soft white order card
      const card = this.add.graphics()
      card.fillStyle(0x000000, 0.12)
      card.fillRoundedRect(x - cardW / 2 + 2, y - 28 + 3, cardW, 96, 18)
      card.fillStyle(0xffffff, 1)
      card.fillRoundedRect(x - cardW / 2, y - 28, cardW, 96, 18)
      card.lineStyle(3, 0xffffff, 1)
      card.strokeRoundedRect(x - cardW / 2, y - 28, cardW, 96, 18)
      this.ordersLayer.add(card)

      // Dark reward header
      const hdr = this.add.graphics()
      hdr.fillStyle(0x3b2a14, 0.88)
      hdr.fillRoundedRect(x - cardW / 2 + 6, y - 22, cardW - 12, 22, 10)
      this.ordersLayer.add(hdr)
      const starNote = mergeSave.data.ordersPlus ? order.stars * 2 : order.stars
      const rewards = this.add
        .text(x, y - 11, `★${starNote}  🪙${order.coins}  ⚡+`, {
          fontFamily: FONT.display,
          fontSize: '10px',
          color: '#ffd93d',
          fontStyle: '800',
        })
        .setOrigin(0.5)
      this.ordersLayer.add(rewards)

      // Need icons
      let ox = x - ((order.needs.length - 1) * 28) / 2
      order.needs.forEach((n) => {
        const def = ITEM_BY_ID[n.itemId]
        const have = this.board.countItem(n.itemId)
        if (def && this.textures.exists(def.texture)) {
          const img = this.add.image(ox, y + 22, def.texture)
          img.setDisplaySize(32, 32)
          this.ordersLayer.add(img)
        }
        const tick = this.add
          .text(ox, y + 40, have >= n.qty ? '✓' : `${have}/${n.qty}`, {
            fontFamily: FONT.display,
            fontSize: '10px',
            color: have >= n.qty ? '#16a34a' : '#64748b',
            fontStyle: '900',
          })
          .setOrigin(0.5)
        this.ordersLayer.add(tick)
        ox += 28
      })

      // Green gem buy affordance
      const gemCost = 6 + i * 7
      const gem = this.add.graphics()
      gem.fillStyle(0x22c55e, 1)
      gem.fillRoundedRect(x - 28, y + 50, 56, 18, 9)
      this.ordersLayer.add(gem)
      const gemTxt = this.add
        .text(x, y + 59, `💎${gemCost}`, {
          fontFamily: FONT.display,
          fontSize: '10px',
          color: '#ffffff',
          fontStyle: '900',
        })
        .setOrigin(0.5)
      this.ordersLayer.add(gemTxt)
      const gemHit = this.add
        .rectangle(x, y + 59, 56, 18, 0x000000, 0.001)
        .setInteractive({ useHandCursor: true })
      gemHit.on('pointerup', () => {
        this.juice.floatText(x, y, 'Gem skip stub', '#22c55e')
        audioSystem.play('click')
      })
      this.ordersLayer.add(gemHit)

      // Deliver hit on card
      const hit = this.add
        .rectangle(x, y + 10, cardW - 8, 50, 0x000000, 0.001)
        .setInteractive({ useHandCursor: true })
      hit.on('pointerup', () => this.tryDeliver(i))
      this.ordersLayer.add(hit)
    })
  }

  private buildEventChips(): void {
    // Small event progress chips under orders
    const y = ORDERS_Y + 130
    const chip = (cx: number, label: string, fill: number) => {
      const g = this.add.graphics().setDepth(14)
      g.fillStyle(0x000000, 0.12)
      g.fillRoundedRect(cx - 36, y - 10 + 2, 72, 20, 10)
      g.fillStyle(fill, 1)
      g.fillRoundedRect(cx - 36, y - 10, 72, 20, 10)
      g.lineStyle(2, 0xffffff, 0.9)
      g.strokeRoundedRect(cx - 36, y - 10, 72, 20, 10)
      this.add
        .text(cx, y, label, {
          fontFamily: FONT.display,
          fontSize: '10px',
          color: '#ffffff',
          fontStyle: '900',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(14)
    }
    chip(70, '⚡ x2', 0x3b82f6)
    const q = nextQuest(mergeSave.data.completedHotspots, mergeSave.data.unlockedStory)
    chip(195, q ? `! ${ITEM_BY_ID[q.needItemId]?.name ?? 'Quest'}` : 'MAP ★', 0xff7a33)
    chip(320, `♥${mergeSave.data.completedHotspots.length}`, 0xec4899)
  }

  private drawGrid(): void {
    if (this.gridGfx) this.gridGfx.destroy()
    this.gridGfx = this.add.graphics().setDepth(1)

    const pad = 10
    const bw = this.board.cols * this.cellSize + pad * 2
    const bh = this.board.rows * this.cellSize + pad * 2
    const bx = this.gridOriginX - this.cellSize / 2 - pad
    const by = this.gridOriginY - this.cellSize / 2 - pad

    // Muted blue-grey board so items pop
    this.gridGfx.fillStyle(0x000000, 0.18)
    this.gridGfx.fillRoundedRect(bx + 3, by + 4, bw, bh, 22)
    this.gridGfx.fillStyle(0x6b7c93, 1)
    this.gridGfx.fillRoundedRect(bx, by, bw, bh, 22)
    this.gridGfx.fillStyle(0x7d8fa8, 0.55)
    this.gridGfx.fillRoundedRect(bx + 4, by + 4, bw - 8, 18, 12)

    const level = mergeSave.data.level
    for (let y = 0; y < this.board.rows; y++) {
      for (let x = 0; x < this.board.cols; x++) {
        const cx = this.gridOriginX + x * this.cellSize
        const cy = this.gridOriginY + y * this.cellSize
        const open = this.board.isUnlocked(x, y, level)
        const cell = this.board.get(x, y)
        const forOrder = !!(cell && this.orderNeedIds.has(cell.itemId))

        if (open) {
          // Beveled recessed cell
          this.gridGfx.fillStyle(0x5a6b82, 1)
          this.gridGfx.fillRoundedRect(cx - 21, cy - 21, 42, 42, 10)
          this.gridGfx.fillStyle(forOrder ? 0xb8f0c8 : 0x8a9bb3, 1)
          this.gridGfx.fillRoundedRect(cx - 19, cy - 19, 38, 38, 9)
          this.gridGfx.lineStyle(2, 0xffffff, 0.22)
          this.gridGfx.strokeRoundedRect(cx - 19, cy - 19, 38, 38, 9)
        } else {
          this.gridGfx.fillStyle(0x4a5568, 0.9)
          this.gridGfx.fillRoundedRect(cx - 21, cy - 21, 42, 42, 10)
          this.gridGfx.lineStyle(2, 0x94a3b8, 0.45)
          for (let i = -12; i <= 12; i += 6) {
            this.gridGfx.lineBetween(cx + i, cy - 14, cx + i, cy + 14)
          }
          this.add
            .text(cx, cy, `Lv${cellUnlockLevel(x, y)}`, {
              fontFamily: FONT.display,
              fontSize: '9px',
              color: '#ffe08a',
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
    const forOrder = this.orderNeedIds.has(itemId)

    const shadow = this.add.ellipse(0, 15, 28, 9, 0x000000, 0.28)
    let art: Phaser.GameObjects.GameObject
    if (this.textures.exists(def.texture)) {
      const img = this.add.image(0, 0, def.texture)
      img.setDisplaySize(40, 40)
      art = img
    } else {
      const body = this.add.graphics()
      body.fillStyle(def.color, 1)
      body.fillRoundedRect(-18, -18, 36, 36, 10)
      art = this.add.container(0, 0, [
        body,
        this.add.text(0, 0, def.emoji, { fontSize: '20px' }).setOrigin(0.5),
      ])
    }
    const tier = this.add
      .text(14, 14, `${def.tier}`, {
        fontFamily: FONT.body,
        fontSize: '10px',
        color: '#ffffff',
        fontStyle: '900',
        backgroundColor: forOrder ? '#22c55e' : '#f59e0b',
        padding: { x: 3, y: 0 },
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)

    const container = this.add.container(pos.x, pos.y, [shadow, art, tier]).setSize(42, 42)
    container.setDepth(10)
    container.setInteractive(new Phaser.Geom.Rectangle(-21, -21, 42, 42), Phaser.Geom.Rectangle.Contains)
    this.juice.shineSweep(container, 16, 16)

    const view: TokenView = { uid, itemId, gx, gy, container, baseY: pos.y }
    this.tokens.set(uid, view)
    this.juice.idleFloat(container, pos.y, Math.random() * 500)

    container.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.dragging) return
      this.selected = view
      this.updateTray()
      this.dragging = view
      this.dragOffset = { x: container.x - p.x, y: container.y - p.y }
      container.setDepth(40)
      this.tweens.killTweensOf(container)
      this.tweens.add({ targets: container, scale: 1.18, duration: 70, ease: 'Back.out' })
      audioSystem.play('click')
      hapticsSystem.tap()
    })

    if (pop) {
      container.setScale(0.1)
      this.tweens.add({ targets: container, scale: 1, duration: 280, ease: 'Back.out' })
    }
  }

  /** Generators as colorful spawners with pink/yellow bolt badges (board-adjacent). */
  private buildOnBoardGenerators(): void {
    const unlocked = GENERATORS.filter((g) => mergeSave.isGeneratorUnlocked(g.id))
    const locked = GENERATORS.filter((g) => !mergeSave.isGeneratorUnlocked(g.id))
    const shown = [...unlocked, ...locked]

    shown.forEach((gen, i) => {
      // Colorful spawners just above the blue-grey board (bolt badges like reference)
      const x = GAME.width / 2 + (i === 0 ? -40 : 40)
      const y = GRID_TOP - 4
      const open = mergeSave.isGeneratorUnlocked(gen.id)
      const boltColor = i === 0 ? 0xff4d8d : 0xffd93d

      const body = this.add.graphics().setDepth(12)
      body.fillStyle(0x000000, 0.2)
      body.fillRoundedRect(x - 22, y - 22 + 3, 44, 44, 12)
      body.fillStyle(open ? (i === 0 ? 0xff8fab : 0xffe066) : 0x94a3b8, 1)
      body.fillRoundedRect(x - 22, y - 22, 44, 44, 12)
      body.lineStyle(3, 0xffffff, 0.85)
      body.strokeRoundedRect(x - 22, y - 22, 44, 44, 12)

      if (this.textures.exists(gen.texture) && open) {
        const img = this.add.image(x, y - 2, gen.texture).setDepth(13)
        img.setDisplaySize(34, 34)
      } else {
        this.add
          .text(x, y - 2, open ? gen.emoji : '🔒', { fontSize: '20px' })
          .setOrigin(0.5)
          .setDepth(13)
      }

      // Bolt badge
      const badge = this.add.graphics().setDepth(14)
      badge.fillStyle(boltColor, 1)
      badge.fillCircle(x + 14, y + 14, 10)
      badge.lineStyle(2, 0xffffff, 1)
      badge.strokeCircle(x + 14, y + 14, 10)
      this.add
        .text(x + 14, y + 14, '⚡', { fontSize: '11px' })
        .setOrigin(0.5)
        .setDepth(15)

      // Sparkles when ready
      if (open) {
        for (let s = 0; s < 3; s++) {
          const sp = this.add.star(x + Phaser.Math.Between(-16, 16), y + Phaser.Math.Between(-16, 16), 4, 2, 4, 0xffffff, 0.8).setDepth(14)
          this.tweens.add({
            targets: sp,
            alpha: 0.2,
            scale: 0.5,
            duration: 700 + s * 200,
            yoyo: true,
            repeat: -1,
          })
        }
      }

      const ring = this.add.graphics().setDepth(14)
      this.genRings[i] = ring
      this.genCenters.push({ x, y, id: gen.id })

      const ready = this.add
        .text(x, y + 28, '', {
          fontFamily: FONT.display,
          fontSize: '9px',
          color: '#ffffff',
          fontStyle: '900',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(15)
      this.genReadyText[i] = ready
      ;(ready as Phaser.GameObjects.Text & { genId?: string }).genId = gen.id

      const hit = this.add
        .rectangle(x, y, 44, 44, 0x000000, 0.001)
        .setDepth(16)
        .setInteractive({ useHandCursor: true })
      hit.on('pointerdown', () => this.juice.press(hit))
      hit.on('pointerup', () => {
        if (!open) {
          this.juice.floatText(GAME.width / 2, GRID_TOP, 'Restore on MAP ★', '#ffd93d')
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
      const ring = this.genRings[i]
      const center = this.genCenters[i]
      if (!gen || !label) return
      if (!mergeSave.isGeneratorUnlocked(gen.id)) {
        label.setText('MAP')
        ring?.clear()
        return
      }
      const readyAt = mergeSave.data.generatorReadyAt[gen.id] ?? 0
      const left = Math.max(0, readyAt - Date.now())
      const progress = left > 0 ? 1 - left / gen.cooldownMs : 1
      if (ring && center) {
        ring.clear()
        ring.lineStyle(3, 0xffffff, 0.35)
        ring.beginPath()
        ring.arc(center.x - 14, center.y + 14, 8, 0, Math.PI * 2)
        ring.strokePath()
        ring.lineStyle(3, left > 0 ? 0x38bdf8 : 0x22c55e, 1)
        ring.beginPath()
        ring.arc(center.x - 14, center.y + 14, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress)
        ring.strokePath()
      }
      label.setText(left > 0 ? `${Math.ceil(left / 1000)}s` : `${gen.energyCost}⚡`)
    })
  }

  private tapGenerator(gen: GeneratorDef, gx: number, gy: number): void {
    const readyAt = mergeSave.data.generatorReadyAt[gen.id] ?? 0
    if (Date.now() < readyAt) {
      this.juice.floatText(gx, gy - 30, 'Charging…', '#38bdf8')
      return
    }
    if (!mergeSave.spendEnergy(gen.energyCost)) {
      audioSystem.play('warning')
      this.juice.floatText(GAME.width / 2, GRID_TOP, 'Out of energy!', '#ff4d6d')
      this.offerEnergyRefill()
      return
    }
    const level = mergeSave.data.level
    const empty = this.board.findEmpty(level)
    if (!empty) {
      mergeSave.data.energy = Math.min(mergeSave.maxEnergy(), mergeSave.data.energy + gen.energyCost)
      mergeSave.persist()
      this.juice.floatText(GAME.width / 2, GRID_TOP, 'Board full!', '#ff7a18')
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
      this.juice.burst(dest.x, dest.y, def?.color ?? 0x22c55e, 12)
      this.drawGrid()
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

  private buildBottomBar(): void {
    // Chain hang motif
    const chain = this.add.graphics().setDepth(18)
    chain.lineStyle(3, 0xc0c8d4, 1)
    chain.lineBetween(48, BOTTOM_Y - 18, 48, BOTTOM_Y + 8)
    chain.lineBetween(GAME.width - 48, BOTTOM_Y - 18, GAME.width - 48, BOTTOM_Y + 8)
    for (let i = 0; i < 3; i++) {
      chain.strokeCircle(48, BOTTOM_Y - 14 + i * 7, 3)
      chain.strokeCircle(GAME.width - 48, BOTTOM_Y - 14 + i * 7, 3)
    }

    // Teal inventory / arrow buttons
    const sideBtn = (x: number, label: string, onClick: () => void) => {
      const g = this.add.graphics().setDepth(19)
      g.fillStyle(0x000000, 0.18)
      g.fillRoundedRect(x - 28, BOTTOM_Y + 10 + 3, 56, 56, 16)
      g.fillStyle(0x14b8a6, 1)
      g.fillRoundedRect(x - 28, BOTTOM_Y + 10, 56, 56, 16)
      g.lineStyle(3, 0xffffff, 0.85)
      g.strokeRoundedRect(x - 28, BOTTOM_Y + 10, 56, 56, 16)
      this.add
        .text(x, BOTTOM_Y + 38, label, { fontSize: '24px' })
        .setOrigin(0.5)
        .setDepth(20)
      const hit = this.add
        .rectangle(x, BOTTOM_Y + 38, 56, 56, 0x000000, 0.001)
        .setDepth(21)
        .setInteractive({ useHandCursor: true })
      hit.on('pointerdown', () => this.juice.press(hit))
      hit.on('pointerup', onClick)
    }
    sideBtn(48, '📦', () => this.juice.floatText(GAME.width / 2, BOTTOM_Y, 'Inventory soon', '#14b8a6'))
    sideBtn(GAME.width - 48, '➤', () => {
      this.persistBoard()
      this.scene.start('Story')
    })

    // Beige info tray
    const tray = this.add.graphics().setDepth(19)
    tray.fillStyle(0x000000, 0.15)
    tray.fillRoundedRect(84, BOTTOM_Y + 14 + 3, GAME.width - 168, 52, 16)
    tray.fillStyle(0xf5e6c8, 1)
    tray.fillRoundedRect(82, BOTTOM_Y + 14, GAME.width - 164, 52, 16)
    tray.lineStyle(3, 0xffffff, 0.9)
    tray.strokeRoundedRect(82, BOTTOM_Y + 14, GAME.width - 164, 52, 16)

    this.trayName = this.add
      .text(GAME.width / 2, BOTTOM_Y + 32, 'Tap an item', {
        fontFamily: FONT.display,
        fontSize: '14px',
        color: '#3b2a14',
        fontStyle: '900',
      })
      .setOrigin(0.5)
      .setDepth(20)
    this.trayHint = this.add
      .text(GAME.width / 2, BOTTOM_Y + 50, 'Merge matches · green cells = order needs', {
        fontFamily: FONT.body,
        fontSize: '10px',
        color: '#6b5a3e',
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setDepth(20)
  }

  private updateTray(): void {
    if (!this.selected) {
      this.trayName.setText('Tap an item')
      this.trayHint.setText('Merge matches · green cells = order needs')
      return
    }
    const def = ITEM_BY_ID[this.selected.itemId]
    this.trayName.setText(def ? `${def.name}  ·  Tier ${def.tier}` : this.selected.itemId)
    if (this.orderNeedIds.has(this.selected.itemId)) {
      this.trayHint.setText('Needed for an order — tap the portrait card!')
    } else {
      this.trayHint.setText('Drag onto a match to merge')
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
      this.highlight.lineStyle(4, !open ? 0x94a3b8 : canMerge ? 0x22c55e : 0xffe066, 1)
      this.highlight.strokeRoundedRect(c.x - 22, c.y - 22, 44, 44, 10)
      if (canMerge) {
        this.dragging.container.x += (c.x - this.dragging.container.x) * 0.15
        this.dragging.container.y += (c.y - this.dragging.container.y) * 0.15
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
      this.juice.floatText(GAME.width / 2, GRID_TOP + 40, `Lv${cellUnlockLevel(cell.x, cell.y)}`, '#ffd93d')
      this.snapToken(view)
      return
    }

    const target = this.board.get(cell.x, cell.y)
    if (target && target.uid !== view.uid && target.itemId === view.itemId) {
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
    if (!target && this.board.tryMove(view.gx, view.gy, cell.x, cell.y, level)) {
      view.gx = cell.x
      view.gy = cell.y
      view.baseY = this.cellCenter(cell.x, cell.y).y
      this.snapToken(view)
      this.persistBoard()
      return
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
    this.tokens.get(targetUid)?.container.destroy(true)
    view.container.destroy(true)
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
    this.drawGrid()
    this.buildOrderRow()
    this.refreshHud()
    this.updateTray()
    if (mergeSave.addXp(2)) {
      this.juice.floatText(GAME.width / 2, GRID_TOP, 'LEVEL UP!', '#ffd93d', 22)
      this.time.delayedCall(450, () => this.scene.restart())
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

  private tryDeliver(index: number): void {
    const order = mergeSave.data.orders[index]
    if (!order) return
    for (const need of order.needs) {
      if (this.board.countItem(need.itemId) < need.qty) {
        audioSystem.play('warning')
        this.juice.floatText(GAME.width / 2, ORDERS_Y + 40, 'Need more items!', '#ff7a18')
        return
      }
    }
    for (const need of order.needs) this.board.consume(need.itemId, need.qty)
    const completed = mergeSave.completeOrder(index)
    this.persistBoard()
    const stars = (completed?.stars ?? 0) * (mergeSave.data.ordersPlus ? 2 : 1)
    this.juice.starsBurst(GAME.width / 2, ORDERS_Y + 60)
    this.juice.floatText(GAME.width / 2, ORDERS_Y + 20, `+${stars}★`, '#ffd93d', 22)
    this.cameras.main.flash(120, 255, 230, 150)
    this.time.delayedCall(400, () => this.scene.restart())
  }

  private offerEnergyRefill(): void {
    createButton(this, {
      x: GAME.width / 2 - 70,
      y: BOTTOM_Y - 30,
      width: 120,
      height: 34,
      label: 'Ad ⚡',
      fill: COLORS.info,
      fontSize: 13,
      onClick: async () => {
        const res = await monetization.showRewardedAd('energy_refill')
        if (res.watched) {
          mergeSave.refillEnergyFull()
          this.refreshHud()
        }
      },
    })
    createButton(this, {
      x: GAME.width / 2 + 70,
      y: BOTTOM_Y - 30,
      width: 120,
      height: 34,
      label: '40🪙 → ⚡',
      fill: COLORS.gold,
      textColor: '#1a2744',
      fontSize: 12,
      onClick: () => {
        if (mergeSave.spendCoins(40)) {
          mergeSave.refillEnergyFull()
          this.refreshHud()
        }
      },
    })
  }

  private persistBoard(): void {
    mergeSave.data.board = this.board.serialize()
    mergeSave.persist()
  }

  update(): void {
    void ENERGY_REGEN_MS
  }
}
