import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import {
  ENERGY_REGEN_MS,
  GENERATORS,
  ITEM_BY_ID,
  XP_PER_LEVEL,
  type GeneratorDef,
} from '../data/merge/items'
import { BoardModel } from '../systems/merge/BoardModel'
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
  private hudStars!: Phaser.GameObjects.Text
  private hudEnergy!: Phaser.GameObjects.Text
  private hudLevel!: Phaser.GameObjects.Text
  private highlight!: Phaser.GameObjects.Graphics

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

    if (this.textures.exists('board_bg')) {
      const bg = this.add.image(GAME.width / 2, GAME.height / 2, 'board_bg')
      bg.setDisplaySize(GAME.width, GAME.height)
      bg.setAlpha(0.88)
    } else {
      this.cameras.main.setBackgroundColor(COLORS.bgDeep)
    }
    const veil = this.add.graphics()
    veil.fillStyle(0x1a1033, 0.28)
    veil.fillRect(0, 0, GAME.width, 200)
    veil.fillStyle(0x1a1033, 0.45)
    veil.fillRect(0, 560, GAME.width, GAME.height - 560)

    this.cellSize = 56
    const gridW = this.board.cols * this.cellSize
    this.gridOriginX = (GAME.width - gridW) / 2 + this.cellSize / 2
    this.gridOriginY = 300

    this.buildHud()
    this.drawGrid()
    this.highlight = this.add.graphics().setDepth(5)

    this.rebuildTokens()
    this.buildGenerators()
    this.buildOrders()

    createButton(this, {
      x: 40,
      y: 34,
      width: 52,
      height: 34,
      label: '←',
      fill: COLORS.bgPanel,
      fontSize: 18,
      onClick: () => {
        this.persistBoard()
        this.scene.start('Menu')
      },
    })
    createButton(this, {
      x: GAME.width - 52,
      y: 34,
      width: 72,
      height: 34,
      label: 'STORY',
      fill: 0x7c3aed,
      fontSize: 12,
      onClick: () => {
        this.persistBoard()
        this.scene.start('Story')
      },
    })

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onDrag(p))
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onDrop(p))
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.refreshHud() })
  }

  private buildHud(): void {
    const bar = this.add.graphics()
    bar.fillStyle(COLORS.bgPanel, 0.92)
    bar.fillRoundedRect(16, 54, GAME.width - 32, 78, 16)

    this.hudCoins = this.add.text(28, 66, '', {
      fontFamily: FONT.display,
      fontSize: '15px',
      color: '#ffd166',
      fontStyle: '800',
    })
    this.hudStars = this.add.text(140, 66, '', {
      fontFamily: FONT.display,
      fontSize: '15px',
      color: '#fde68a',
      fontStyle: '800',
    })
    this.hudEnergy = this.add.text(28, 96, '', {
      fontFamily: FONT.body,
      fontSize: '13px',
      color: '#4cc9f0',
    })
    this.hudLevel = this.add
      .text(GAME.width - 28, 88, '', {
        fontFamily: FONT.display,
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: '800',
      })
      .setOrigin(1, 0.5)

    this.add
      .text(GAME.width / 2, 150, 'Drag matches · deliver for ★ stars', {
        fontFamily: FONT.body,
        fontSize: '12px',
        color: '#ffffff',
        stroke: '#1a1033',
        strokeThickness: 3,
      })
      .setOrigin(0.5)

    this.refreshHud()
  }

  private refreshHud(): void {
    mergeSave.regenEnergy()
    const d = mergeSave.data
    const max = mergeSave.maxEnergy()
    this.hudCoins?.setText(`🪙 ${d.coins}`)
    this.hudStars?.setText(`★ ${d.stars}`)
    const next = mergeSave.msToNextEnergy()
    const tip = d.energy >= max ? 'full' : `+1 in ${Math.ceil(next / 1000)}s`
    this.hudEnergy?.setText(`⚡ ${d.energy}/${max}  (${tip})`)
    this.hudLevel?.setText(`Lv ${d.level} · ${d.xp}/${XP_PER_LEVEL}`)
    this.refreshGenLabels()
  }

  private drawGrid(): void {
    const g = this.add.graphics()
    for (let y = 0; y < this.board.rows; y++) {
      for (let x = 0; x < this.board.cols; x++) {
        const cx = this.gridOriginX + x * this.cellSize
        const cy = this.gridOriginY + y * this.cellSize
        g.fillStyle(0xffffff, 0.22)
        g.fillRoundedRect(cx - 26, cy - 26, 52, 52, 14)
        g.lineStyle(2, 0xffffff, 0.45)
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

    const shadow = this.add.ellipse(0, 18, 36, 12, 0x000000, 0.25)
    let art: Phaser.GameObjects.GameObject
    if (this.textures.exists(def.texture)) {
      const img = this.add.image(0, 0, def.texture)
      img.setDisplaySize(46, 46)
      art = img
    } else {
      const body = this.add.graphics()
      body.fillStyle(def.color, 1)
      body.fillRoundedRect(-22, -22, 44, 44, 12)
      const emoji = this.add.text(0, 0, def.emoji, { fontSize: '24px' }).setOrigin(0.5)
      art = this.add.container(0, 0, [body, emoji])
    }
    const tier = this.add
      .text(16, 16, `${def.tier}`, {
        fontFamily: FONT.body,
        fontSize: '11px',
        color: '#1a1033',
        fontStyle: '800',
        backgroundColor: '#ffd166',
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0.5)

    const container = this.add.container(pos.x, pos.y, [shadow, art, tier]).setSize(48, 48)
    container.setDepth(10)
    container.setInteractive(
      new Phaser.Geom.Rectangle(-24, -24, 48, 48),
      Phaser.Geom.Rectangle.Contains,
    )

    const view: TokenView = { uid, itemId, gx, gy, container }
    this.tokens.set(uid, view)

    container.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.dragging) return
      this.dragging = view
      this.dragOffset = { x: container.x - p.x, y: container.y - p.y }
      container.setDepth(30)
      this.tweens.add({ targets: container, scale: 1.14, duration: 80 })
      audioSystem.play('click')
      hapticsSystem.tap()
    })

    if (pop) {
      container.setScale(0.15)
      this.tweens.add({ targets: container, scale: 1, duration: 240, ease: 'Back.out' })
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
        !!target && target.uid !== this.dragging.uid && target.itemId === this.dragging.itemId
      this.highlight.lineStyle(4, canMerge ? COLORS.success : COLORS.gold, 0.95)
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
        if (mergeSave.addXp(2)) this.floatText(GAME.width / 2, 200, 'LEVEL UP! +★', COLORS.gold)
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
    this.cameras.main.shake(70, 0.005)
    for (let i = 0; i < 16; i++) {
      const p = this.add.circle(c.x, c.y, Phaser.Math.Between(3, 7), color, 0.95).setDepth(50)
      this.tweens.add({
        targets: p,
        x: c.x + Phaser.Math.Between(-55, 55),
        y: c.y + Phaser.Math.Between(-55, 55),
        alpha: 0,
        scale: 0.2,
        duration: 420,
        onComplete: () => p.destroy(),
      })
    }
    this.floatText(c.x, c.y - 28, 'MERGE!', COLORS.gold)
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
      y: y - 42,
      alpha: 0,
      duration: 750,
      onComplete: () => t.destroy(),
    })
  }

  private buildGenerators(): void {
    const unlocked = GENERATORS.filter((g) => mergeSave.isGeneratorUnlocked(g.id))
    const locked = GENERATORS.filter((g) => !mergeSave.isGeneratorUnlocked(g.id))
    const shown = [...unlocked, ...locked]

    shown.forEach((gen, i) => {
      const x = 100 + i * 190
      const y = 210
      const open = mergeSave.isGeneratorUnlocked(gen.id)

      if (this.textures.exists(gen.texture) && open) {
        const img = this.add.image(x, y, gen.texture)
        img.setDisplaySize(150, 68)
        img.setAlpha(0.95)
      } else {
        const g = this.add.graphics()
        g.fillStyle(open ? gen.color : 0x3f3f46, 1)
        g.fillRoundedRect(x - 80, y - 34, 160, 68, 18)
      }

      this.add
        .text(x, y - 14, open ? gen.name : `🔒 ${gen.name}`, {
          fontFamily: FONT.display,
          fontSize: '13px',
          color: '#ffffff',
          fontStyle: '800',
          stroke: '#1a1033',
          strokeThickness: 3,
        })
        .setOrigin(0.5)

      const ready = this.add
        .text(x, y + 12, '', {
          fontFamily: FONT.body,
          fontSize: '11px',
          color: '#ffd166',
          stroke: '#1a1033',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
      this.genReadyText[i] = ready
      ;(ready as Phaser.GameObjects.Text & { genId?: string }).genId = gen.id

      const hit = this.add
        .rectangle(x, y, 160, 68, 0x000000, 0.001)
        .setInteractive({ useHandCursor: true })
      hit.on('pointerup', () => {
        if (!open) {
          this.floatText(GAME.width / 2, 250, 'Restore in Haven Story ★', COLORS.gold)
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
        label.setText('Story unlock')
        return
      }
      const readyAt = mergeSave.data.generatorReadyAt[gen.id] ?? 0
      const left = Math.max(0, readyAt - Date.now())
      if (left > 0) label.setText(`⏳ ${Math.ceil(left / 1000)}s · ${gen.energyCost}⚡`)
      else label.setText(`Tap · ${gen.energyCost}⚡`)
    })
  }

  private tapGenerator(gen: GeneratorDef): void {
    const readyAt = mergeSave.data.generatorReadyAt[gen.id] ?? 0
    if (Date.now() < readyAt) {
      this.floatText(GAME.width / 2, 250, 'Cooldowning…', COLORS.warn)
      return
    }
    if (!mergeSave.spendEnergy(gen.energyCost)) {
      audioSystem.play('warning')
      hapticsSystem.warn()
      this.floatText(GAME.width / 2, 250, 'Out of energy!', COLORS.accentHot)
      this.offerEnergyRefill()
      return
    }
    if (!this.board.findEmpty()) {
      mergeSave.data.energy = Math.min(mergeSave.maxEnergy(), mergeSave.data.energy + gen.energyCost)
      mergeSave.persist()
      this.floatText(GAME.width / 2, 250, 'Board full!', COLORS.warn)
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
    createButton(this, {
      x: GAME.width / 2 - 70,
      y: 800,
      width: 120,
      height: 38,
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
      y: 800,
      width: 120,
      height: 38,
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
    const y0 = 600
    this.add.text(24, y0 - 22, 'ORDERS  →  ★ for Story', {
      fontFamily: FONT.display,
      fontSize: '13px',
      color: '#ffd166',
      fontStyle: '800',
      stroke: '#1a1033',
      strokeThickness: 3,
    })

    mergeSave.data.orders.forEach((order, i) => {
      const y = y0 + i * 56
      const g = this.add.graphics()
      g.fillStyle(COLORS.bgPanel, 0.92)
      g.fillRoundedRect(14, y, GAME.width - 28, 50, 14)
      g.lineStyle(2, COLORS.gold, 0.35)
      g.strokeRoundedRect(14, y, GAME.width - 28, 50, 14)

      // need icons
      let ox = 26
      order.needs.forEach((n) => {
        const def = ITEM_BY_ID[n.itemId]
        if (def && this.textures.exists(def.texture)) {
          const img = this.add.image(ox + 12, y + 25, def.texture)
          img.setDisplaySize(28, 28)
        }
        this.add.text(ox + 28, y + 16, `×${n.qty}`, {
          fontFamily: FONT.body,
          fontSize: '12px',
          color: '#ffffff',
        })
        ox += 58
      })

      const starNote = mergeSave.data.ordersPlus ? `★${order.stars}×2` : `★${order.stars}`
      this.add.text(26, y + 32, `+${order.coins}🪙  +${order.xp}XP  ${starNote}`, {
        fontFamily: FONT.body,
        fontSize: '11px',
        color: '#ffd166',
      })

      createButton(this, {
        x: GAME.width - 68,
        y: y + 25,
        width: 86,
        height: 34,
        label: 'DELIVER',
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
        this.floatText(GAME.width / 2, 560, 'Need more items!', COLORS.warn)
        return
      }
    }
    for (const need of order.needs) this.board.consume(need.itemId, need.qty)
    const completed = mergeSave.completeOrder(index)
    this.persistBoard()
    audioSystem.play('coins')
    hapticsSystem.success()
    this.cameras.main.flash(180, 255, 209, 102)
    const stars = (completed?.stars ?? 0) * (mergeSave.data.ordersPlus ? 2 : 1)
    this.floatText(GAME.width / 2, 250, `+${stars}★  Spend in Story!`, COLORS.gold)
    this.time.delayedCall(450, () => this.scene.restart())
  }

  private persistBoard(): void {
    mergeSave.data.board = this.board.serialize()
    mergeSave.persist()
  }

  update(): void {
    void ENERGY_REGEN_MS
  }
}
