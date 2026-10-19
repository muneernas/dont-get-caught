import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import {
  ENERGY_REGEN_MS,
  GENERATORS,
  ITEM_BY_ID,
  MAX_ENERGY,
  XP_PER_LEVEL,
  type GeneratorDef,
} from '../data/merge/items'
import { BoardModel } from '../systems/merge/BoardModel'
import { mergeSave } from '../systems/merge/MergeSave'
import { audioSystem } from '../systems/AudioSystem'
import { hapticsSystem } from '../systems/HapticsSystem'
import { monetization } from '../monetization/stubs'
import { createButton } from '../ui/Button'
import { drawVerticalGradient } from '../ui/Background'

interface TokenView {
  uid: string
  itemId: string
  gx: number
  gy: number
  container: Phaser.GameObjects.Container
  body: Phaser.GameObjects.Graphics
  emoji: Phaser.GameObjects.Text
}

export class MergeScene extends Phaser.Scene {
  private board!: BoardModel
  private tokens = new Map<string, TokenView>()
  private cellSize = 56
  private gridOriginX = 0
  private gridOriginY = 0
  private dragging: TokenView | null = null
  private dragOffset = { x: 0, y: 0 }
  private genReadyText: Phaser.GameObjects.Text[] = []
  private hudCoins!: Phaser.GameObjects.Text
  private hudEnergy!: Phaser.GameObjects.Text
  private hudLevel!: Phaser.GameObjects.Text
  private orderTexts: Phaser.GameObjects.Text[] = []
  private highlight!: Phaser.GameObjects.Graphics

  constructor() {
    super('Merge')
  }

  create(): void {
    for (const key of ['Menu', 'Shop', 'Settings', 'Boot']) {
      if (this.scene.isActive(key) || this.scene.isSleeping(key)) this.scene.stop(key)
    }

    mergeSave.regenEnergy()
    this.board = new BoardModel(mergeSave.data.board)
    this.tokens.clear()
    this.genReadyText = []
    this.orderTexts = []

    drawVerticalGradient(this, 0x2a1b4a, 0x1a1033)

    this.cellSize = 56
    const gridW = this.board.cols * this.cellSize
    this.gridOriginX = (GAME.width - gridW) / 2 + this.cellSize / 2
    this.gridOriginY = 290

    this.buildHud()
    this.drawGrid()
    this.highlight = this.add.graphics().setDepth(5)

    this.rebuildTokens()
    this.buildGenerators()
    this.buildOrders()

    createButton(this, {
      x: 40,
      y: 36,
      width: 56,
      height: 36,
      label: '←',
      fill: COLORS.bgPanel,
      fontSize: 20,
      onClick: () => {
        this.persistBoard()
        this.scene.start('Menu')
      },
    })

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onDrag(p))
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onDrop(p))

    this.time.addEvent({ delay: 500, loop: true, callback: () => this.refreshHud() })
  }

  private buildHud(): void {
    const bar = this.add.graphics()
    bar.fillStyle(COLORS.bgPanel, 0.95)
    bar.fillRoundedRect(16, 56, GAME.width - 32, 70, 16)

    this.hudCoins = this.add.text(32, 72, '', {
      fontFamily: FONT.display,
      fontSize: '16px',
      color: '#ffd166',
      fontStyle: '800',
    })
    this.hudEnergy = this.add.text(32, 98, '', {
      fontFamily: FONT.body,
      fontSize: '14px',
      color: '#4cc9f0',
    })
    this.hudLevel = this.add
      .text(GAME.width - 32, 84, '', {
        fontFamily: FONT.display,
        fontSize: '15px',
        color: '#ffffff',
        fontStyle: '800',
      })
      .setOrigin(1, 0.5)

    this.add
      .text(GAME.width / 2, 148, 'MERGE HAVEN', {
        fontFamily: FONT.display,
        fontSize: '18px',
        color: '#ff6b9d',
        fontStyle: '900',
      })
      .setOrigin(0.5)

    this.add
      .text(GAME.width / 2, 172, 'Drag matches together · feed the orders', {
        fontFamily: FONT.body,
        fontSize: '12px',
        color: '#c4b5e0',
      })
      .setOrigin(0.5)

    this.refreshHud()
  }

  private refreshHud(): void {
    mergeSave.regenEnergy()
    const d = mergeSave.data
    this.hudCoins?.setText(`🪙 ${d.coins}`)
    const next = mergeSave.msToNextEnergy()
    const tip =
      d.energy >= MAX_ENERGY ? 'full' : `+1 in ${Math.ceil(next / 1000)}s`
    this.hudEnergy?.setText(`⚡ ${d.energy}/${MAX_ENERGY}  (${tip})`)
    this.hudLevel?.setText(`Lv ${d.level} · ${d.xp}/${XP_PER_LEVEL} XP`)
    this.refreshOrders()
    this.refreshGenLabels()
  }

  private drawGrid(): void {
    const g = this.add.graphics()
    for (let y = 0; y < this.board.rows; y++) {
      for (let x = 0; x < this.board.cols; x++) {
        const cx = this.gridOriginX + x * this.cellSize
        const cy = this.gridOriginY + y * this.cellSize
        g.fillStyle(COLORS.cell, 0.95)
        g.fillRoundedRect(cx - 26, cy - 26, 52, 52, 14)
        g.lineStyle(2, COLORS.cellEdge, 0.55)
        g.strokeRoundedRect(cx - 26, cy - 26, 52, 52, 14)
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
    const body = this.add.graphics()
    const draw = (scaleGlow = 1) => {
      body.clear()
      body.fillStyle(def.color, 1)
      body.fillRoundedRect(-22 * scaleGlow, -22 * scaleGlow, 44 * scaleGlow, 44 * scaleGlow, 12)
      body.lineStyle(3, 0xffffff, 0.35)
      body.strokeRoundedRect(-22 * scaleGlow, -22 * scaleGlow, 44 * scaleGlow, 44 * scaleGlow, 12)
    }
    draw()
    const emoji = this.add.text(0, -2, def.emoji, { fontSize: '26px' }).setOrigin(0.5)
    const tier = this.add
      .text(16, 14, `${def.tier}`, {
        fontFamily: FONT.body,
        fontSize: '10px',
        color: '#1a1033',
        fontStyle: '700',
        backgroundColor: '#ffd166',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5)

    const container = this.add.container(pos.x, pos.y, [body, emoji, tier]).setSize(48, 48)
    container.setDepth(10)
    container.setInteractive(
      new Phaser.Geom.Rectangle(-24, -24, 48, 48),
      Phaser.Geom.Rectangle.Contains,
    )

    const view: TokenView = { uid, itemId, gx, gy, container, body, emoji }
    this.tokens.set(uid, view)

    container.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.dragging) return
      this.dragging = view
      this.dragOffset = { x: container.x - p.x, y: container.y - p.y }
      container.setDepth(30)
      this.tweens.add({ targets: container, scale: 1.12, duration: 80 })
      audioSystem.play('click')
      hapticsSystem.tap()
    })

    if (pop) {
      container.setScale(0.2)
      this.tweens.add({ targets: container, scale: 1, duration: 220, ease: 'Back.out' })
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
      const target = this.board.get(cell.x, cell.y)
      const canMerge =
        target &&
        target.uid !== this.dragging.uid &&
        target.itemId === this.dragging.itemId &&
        !!ITEM_BY_ID[target.itemId] &&
        target.itemId === this.dragging.itemId
      this.highlight.lineStyle(3, canMerge ? COLORS.success : COLORS.gold, 0.9)
      this.highlight.strokeRoundedRect(c.x - 28, c.y - 28, 56, 56, 14)
    }
  }

  private onDrop(_p: Phaser.Input.Pointer): void {
    if (!this.dragging) return
    const view = this.dragging
    this.dragging = null
    this.highlight.clear()
    view.container.setDepth(10)
    this.tweens.add({ targets: view.container, scale: 1, duration: 80 })

    const cell = this.pointerToCell(view.container.x, view.container.y)
    if (!cell) {
      this.snapToken(view)
      return
    }

    const target = this.board.get(cell.x, cell.y)
    if (target && target.uid !== view.uid && target.itemId === view.itemId) {
      const result = this.board.tryMerge(view.gx, view.gy, cell.x, cell.y)
      if (result) {
        // Remove old views
        const other = this.tokens.get(target.uid)
        view.container.destroy(true)
        other?.container.destroy(true)
        this.tokens.delete(view.uid)
        this.tokens.delete(target.uid)
        this.spawnTokenView(result.item.uid, result.item.itemId, result.x, result.y, true)
        mergeSave.data.totalMerges += 1
        this.mergeJuice(result.x, result.y, result.def.color)
        this.persistBoard()
        this.refreshHud()
        // Tiny XP for merge
        if (mergeSave.addXp(2)) this.floatText(GAME.width / 2, 200, 'LEVEL UP!', COLORS.gold)
        return
      }
    }

    if (!target) {
      if (this.board.tryMove(view.gx, view.gy, cell.x, cell.y)) {
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
    this.tweens.add({ targets: view.container, x: c.x, y: c.y, duration: 120, ease: 'Back.out' })
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
        x: c.x + Phaser.Math.Between(-50, 50),
        y: c.y + Phaser.Math.Between(-50, 50),
        alpha: 0,
        scale: 0.2,
        duration: 380,
        onComplete: () => p.destroy(),
      })
    }
    this.floatText(c.x, c.y - 30, 'MERGE!', COLORS.gold)
  }

  private floatText(x: number, y: number, msg: string, color: number): void {
    const t = this.add
      .text(x, y, msg, {
        fontFamily: FONT.display,
        fontSize: '18px',
        color: '#' + color.toString(16).padStart(6, '0'),
        fontStyle: '900',
        stroke: '#1a1033',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(60)
    this.tweens.add({
      targets: t,
      y: y - 40,
      alpha: 0,
      duration: 700,
      onComplete: () => t.destroy(),
    })
  }

  private buildGenerators(): void {
    GENERATORS.forEach((gen, i) => {
      const x = 100 + i * 190
      const y = 210
      const g = this.add.graphics()
      g.fillStyle(gen.color, 1)
      g.fillRoundedRect(x - 80, y - 36, 160, 72, 18)
      g.lineStyle(3, 0xffffff, 0.25)
      g.strokeRoundedRect(x - 80, y - 36, 160, 72, 18)

      this.add.text(x - 64, y - 22, `${gen.emoji} ${gen.name}`, {
        fontFamily: FONT.display,
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: '800',
      })
      const ready = this.add.text(x - 64, y + 4, '', {
        fontFamily: FONT.body,
        fontSize: '12px',
        color: '#ffd166',
      })
      this.genReadyText[i] = ready

      const hit = this.add
        .rectangle(x, y, 160, 72, 0x000000, 0.001)
        .setInteractive({ useHandCursor: true })
      hit.on('pointerup', () => this.tapGenerator(gen, i))
    })
    this.refreshGenLabels()
  }

  private refreshGenLabels(): void {
    GENERATORS.forEach((gen, i) => {
      const readyAt = mergeSave.data.generatorReadyAt[gen.id] ?? 0
      const left = Math.max(0, readyAt - Date.now())
      const label = this.genReadyText[i]
      if (!label) return
      if (left > 0) label.setText(`⏳ ${Math.ceil(left / 1000)}s · ${gen.energyCost}⚡`)
      else label.setText(`Tap · ${gen.energyCost}⚡`)
    })
  }

  private tapGenerator(gen: GeneratorDef, _i: number): void {
    const readyAt = mergeSave.data.generatorReadyAt[gen.id] ?? 0
    if (Date.now() < readyAt) {
      audioSystem.play('click')
      this.floatText(GAME.width / 2, 240, 'Cooldowning…', COLORS.warn)
      return
    }
    if (!mergeSave.spendEnergy(gen.energyCost)) {
      audioSystem.play('warning')
      hapticsSystem.warn()
      this.floatText(GAME.width / 2, 240, 'Out of energy!', COLORS.accentHot)
      this.offerEnergyRefill()
      return
    }
    if (!this.board.findEmpty()) {
      mergeSave.addCoins(0)
      mergeSave.data.energy = Math.min(MAX_ENERGY, mergeSave.data.energy + gen.energyCost)
      mergeSave.persist()
      this.floatText(GAME.width / 2, 240, 'Board full!', COLORS.warn)
      this.refreshHud()
      return
    }

    const itemId = this.rollOutput(gen)
    const spawned = this.board.spawn(itemId)
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
    // Soft prompt via floating buttons once
    createButton(this, {
      x: GAME.width / 2 - 70,
      y: 780,
      width: 120,
      height: 40,
      label: 'Ad ⚡',
      fill: COLORS.info,
      fontSize: 14,
      onClick: async () => {
        const res = await monetization.showRewardedAd('energy_refill')
        if (res.watched) {
          mergeSave.refillEnergyFull()
          this.floatText(GAME.width / 2, 250, 'Energy full!', COLORS.success)
          this.refreshHud()
        }
      },
    })
    createButton(this, {
      x: GAME.width / 2 + 70,
      y: 780,
      width: 120,
      height: 40,
      label: '40🪙 → ⚡',
      fill: COLORS.gold,
      fontSize: 13,
      onClick: () => {
        if (mergeSave.spendCoins(40)) {
          mergeSave.refillEnergyFull()
          this.floatText(GAME.width / 2, 250, 'Energy full!', COLORS.success)
          this.refreshHud()
        }
      },
    })
  }

  private buildOrders(): void {
    const y0 = 590
    this.add.text(24, y0 - 24, 'ORDERS', {
      fontFamily: FONT.display,
      fontSize: '14px',
      color: '#ffd166',
      fontStyle: '800',
    })

    mergeSave.data.orders.forEach((order, i) => {
      const y = y0 + i * 58
      const g = this.add.graphics()
      g.fillStyle(COLORS.card, 1)
      g.fillRoundedRect(16, y, GAME.width - 32, 52, 14)

      const needStr = order.needs
        .map((n) => {
          const def = ITEM_BY_ID[n.itemId]
          return `${def?.emoji ?? '?'}×${n.qty}`
        })
        .join('  ')
      const t = this.add.text(28, y + 8, needStr, {
        fontFamily: FONT.body,
        fontSize: '16px',
        color: '#ffffff',
      })
      const reward = this.add.text(28, y + 28, `+${order.coins}🪙  +${order.xp}XP`, {
        fontFamily: FONT.body,
        fontSize: '12px',
        color: '#ffd166',
      })
      this.orderTexts.push(t, reward)

      createButton(this, {
        x: GAME.width - 70,
        y: y + 26,
        width: 88,
        height: 36,
        label: 'DELIVER',
        fill: COLORS.success,
        fontSize: 12,
        onClick: () => this.tryDeliver(i),
      })
    })
  }

  private refreshOrders(): void {
    // Texts are static labels; rebuild progress tint via deliver availability only
  }

  private tryDeliver(index: number): void {
    const order = mergeSave.data.orders[index]
    if (!order) return
    for (const need of order.needs) {
      if (this.board.countItem(need.itemId) < need.qty) {
        audioSystem.play('warning')
        this.floatText(GAME.width / 2, 560, 'Need more items!', COLORS.warn)
        return
      }
    }
    for (const need of order.needs) this.board.consume(need.itemId, need.qty)
    const completed = mergeSave.completeOrder(index)
    this.persistBoard()
    this.rebuildTokens()
    audioSystem.play('coins')
    hapticsSystem.success()
    this.cameras.main.flash(180, 6, 214, 160)
    this.floatText(GAME.width / 2, 250, `Order! +${completed?.coins ?? 0}🪙`, COLORS.gold)
    // Rebuild order row labels simply by restarting scene UI chunk
    this.scene.restart()
  }

  private persistBoard(): void {
    mergeSave.data.board = this.board.serialize()
    mergeSave.persist()
  }

  update(): void {
    // keep energy labels warm
    void ENERGY_REGEN_MS
  }
}
