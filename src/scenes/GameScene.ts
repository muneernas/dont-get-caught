import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import { getLevel, type ActionConfig, type LevelConfig } from '../data/levels'
import { NpcController } from '../systems/NpcController'
import { SuspicionSystem } from '../systems/SuspicionSystem'
import { audioSystem } from '../systems/AudioSystem'
import { hapticsSystem } from '../systems/HapticsSystem'
import { monetization } from '../monetization/stubs'
import { saveSystem } from '../systems/SaveSystem'
import { ProgressBar, suspicionColor } from '../ui/Bars'
import { drawVerticalGradient } from '../ui/Background'
import { createButton } from '../ui/Button'
import { formatTime } from '../utils/format'

interface ActionRuntime {
  config: ActionConfig
  coolingUntil: number
  busyUntil: number
  card: Phaser.GameObjects.Container
  fill: Phaser.GameObjects.Graphics
  status: Phaser.GameObjects.Text
}

export class GameScene extends Phaser.Scene {
  private levelId = 'classroom'
  private level!: LevelConfig
  private suspicion!: SuspicionSystem
  private npcs = new NpcController()
  private progress = 0
  private elapsed = 0
  private ended = false
  private acting = false
  private behaving = false
  private noise = 0
  private actionUses: Record<string, number> = {}
  private challengeBroken = false
  private revealUntil = 0
  private warningLatched = false
  private shieldLeft = 0

  private progressBar!: ProgressBar
  private suspicionBar!: ProgressBar
  private timerText!: Phaser.GameObjects.Text
  private npcLayer!: Phaser.GameObjects.Container
  private npcViews: Map<string, Phaser.GameObjects.Container> = new Map()
  private player!: Phaser.GameObjects.Container
  private actions: ActionRuntime[] = []
  private flash!: Phaser.GameObjects.Rectangle
  private awarenessText!: Phaser.GameObjects.Text

  constructor() {
    super('Game')
  }

  init(data: { levelId?: string }): void {
    this.levelId = data.levelId ?? 'classroom'
  }

  create(): void {
    const level = getLevel(this.levelId)
    if (!level) {
      this.scene.start('Menu')
      return
    }
    this.level = level
    this.suspicion = new SuspicionSystem(level.baseSuspicionDecay)
    this.shieldLeft = saveSystem.consumeBoost('suspicionShield') ? 25 : 0
    this.progress = 0
    this.elapsed = 0
    this.ended = false
    this.acting = false
    this.behaving = false
    this.noise = 0
    this.actionUses = {}
    this.challengeBroken = false
    this.revealUntil = 0
    this.warningLatched = false
    this.actions = []
    this.npcViews.clear()

    drawVerticalGradient(this, level.bgTop, level.bgBottom)

    // Stage / room
    const stage = this.add.graphics()
    stage.fillStyle(0x000000, 0.22)
    stage.fillRoundedRect(18, 150, GAME.width - 36, 220, 24)

    this.add
      .text(24, 48, level.location.toUpperCase(), {
        fontFamily: FONT.body,
        fontSize: '12px',
        color: '#ffd166',
      })
    this.add.text(24, 68, level.objective, {
      fontFamily: FONT.display,
      fontSize: '15px',
      color: '#ffffff',
      fontStyle: '800',
      wordWrap: { width: GAME.width - 48 },
    })

    this.timerText = this.add
      .text(GAME.width - 24, 48, '0:00', {
        fontFamily: FONT.body,
        fontSize: '14px',
        color: '#a8b4c8',
      })
      .setOrigin(1, 0)

    this.progressBar = new ProgressBar(this, GAME.width / 2, 120, GAME.width - 48, 18, COLORS.success, 'Progress')
    this.suspicionBar = new ProgressBar(
      this,
      GAME.width / 2,
      158,
      GAME.width - 48,
      18,
      COLORS.suspicionLow,
      'Suspicion',
    )

    this.awarenessText = this.add
      .text(GAME.width / 2, 178, '', {
        fontFamily: FONT.body,
        fontSize: '12px',
        color: '#4cc9f0',
      })
      .setOrigin(0.5)
      .setAlpha(0)

    this.npcLayer = this.add.container(0, 0)
    this.npcs.init(level)
    this.npcs.setPlayer(GAME.width / 2, 300)
    for (const npc of this.npcs.npcs) {
      const view = this.makeNpcView(npc.config.name, npc.config.color)
      view.setPosition(npc.x, npc.y)
      this.npcLayer.add(view)
      this.npcViews.set(npc.config.id, view)
    }

    this.player = this.makePlayer()
    this.player.setPosition(GAME.width / 2, 300)

    this.buildActionCards()

    this.flash = this.add.rectangle(GAME.width / 2, GAME.height / 2, GAME.width, GAME.height, 0xff0000, 0)
    this.flash.setDepth(100)

    createButton(this, {
      x: GAME.width - 40,
      y: GAME.height - 36,
      width: 56,
      height: 36,
      label: '⏸',
      fill: COLORS.bgPanel,
      fontSize: 16,
      onClick: () => this.showPause(),
    })
  }

  private makePlayer(): Phaser.GameObjects.Container {
    const body = this.add.circle(0, 0, 22, COLORS.info)
    const face = this.add.circle(0, -2, 14, 0xffe0b2)
    const l = this.add.circle(-5, -4, 2, 0x222222)
    const r = this.add.circle(5, -4, 2, 0x222222)
    const label = this.add
      .text(0, 28, 'YOU', {
        fontFamily: FONT.body,
        fontSize: '10px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
    const c = this.add.container(0, 0, [body, face, l, r, label])
    this.tweens.add({
      targets: c,
      y: '+=4',
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    return c
  }

  private makeNpcView(name: string, color: number): Phaser.GameObjects.Container {
    const ring = this.add.circle(0, 0, 34, color, 0.15)
    const body = this.add.circle(0, 0, 20, color)
    const eye = this.add.triangle(10, 0, 0, -5, 12, 0, 0, 5, 0xffffff)
    const label = this.add
      .text(0, 30, name, {
        fontFamily: FONT.body,
        fontSize: '10px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
    const state = this.add
      .text(0, -30, '', {
        fontFamily: FONT.body,
        fontSize: '9px',
        color: '#ffd166',
      })
      .setOrigin(0.5)
    const c = this.add.container(0, 0, [ring, body, eye, label, state])
    ;(c as Phaser.GameObjects.Container & { stateText: Phaser.GameObjects.Text; ring: Phaser.GameObjects.Arc }).stateText =
      state
    ;(c as Phaser.GameObjects.Container & { ring: Phaser.GameObjects.Arc }).ring = ring
    return c
  }

  private buildActionCards(): void {
    const actions = this.level.actions
    const cols = 1
    const startY = 400
    const cardH = 72
    const gap = 8
    actions.forEach((action, i) => {
      const y = startY + i * (cardH + gap)
      const width = GAME.width - 40
      const bg = this.add.graphics()
      const draw = (pressed: boolean, dimmed: boolean) => {
        bg.clear()
        bg.fillStyle(dimmed ? 0x1c2436 : pressed ? COLORS.cardPress : COLORS.card, 1)
        bg.fillRoundedRect(-width / 2, -cardH / 2, width, cardH, 16)
        bg.lineStyle(2, this.level.accent, dimmed ? 0.15 : 0.45)
        bg.strokeRoundedRect(-width / 2, -cardH / 2, width, cardH, 16)
      }
      draw(false, false)
      const fill = this.add.graphics()
      const icon = this.add.text(-width / 2 + 18, 0, action.icon, { fontSize: '26px' }).setOrigin(0, 0.5)
      const title = this.add
        .text(-width / 2 + 56, -12, action.label, {
          fontFamily: FONT.display,
          fontSize: '17px',
          color: '#ffffff',
          fontStyle: '800',
        })
        .setOrigin(0, 0.5)
      const hint = this.add
        .text(-width / 2 + 56, 12, action.hint ?? this.deltaLabel(action), {
          fontFamily: FONT.body,
          fontSize: '12px',
          color: '#a8b4c8',
        })
        .setOrigin(0, 0.5)
      const status = this.add
        .text(width / 2 - 16, 0, '', {
          fontFamily: FONT.body,
          fontSize: '12px',
          color: '#4cc9f0',
        })
        .setOrigin(1, 0.5)

      const hit = this.add
        .rectangle(0, 0, width, cardH, 0x000000, 0.001)
        .setInteractive({ useHandCursor: true })

      const card = this.add.container(GAME.width / 2, y, [bg, fill, icon, title, hint, status, hit])
      const runtime: ActionRuntime = {
        config: action,
        coolingUntil: 0,
        busyUntil: 0,
        card,
        fill,
        status,
      }
      this.actions.push(runtime)

      hit.on('pointerdown', () => {
        if (this.ended || this.acting) return
        if (this.time.now < runtime.coolingUntil) return
        draw(true, false)
        this.tweens.add({ targets: card, scale: 0.97, duration: 60 })
      })
      hit.on('pointerup', () => {
        draw(false, false)
        this.tweens.add({ targets: card, scale: 1, duration: 80 })
        this.tryAction(runtime)
      })
      hit.on('pointerout', () => {
        draw(false, this.time.now < runtime.coolingUntil)
        card.setScale(1)
      })

      // store redraw
      ;(card as Phaser.GameObjects.Container & { redraw: (p: boolean, d: boolean) => void }).redraw = draw
      void cols
    })
  }

  private deltaLabel(a: ActionConfig): string {
    const parts: string[] = []
    if (a.progressDelta) parts.push(`${a.progressDelta > 0 ? '+' : ''}${a.progressDelta}%`)
    if (a.suspicionDelta) parts.push(`sus ${a.suspicionDelta > 0 ? '+' : ''}${a.suspicionDelta}`)
    return parts.join(' · ') || 'Utility'
  }

  private tryAction(runtime: ActionRuntime): void {
    if (this.ended || this.acting) return
    if (this.time.now < runtime.coolingUntil) return

    const action = runtime.config
    this.acting = true
    this.behaving = action.suspicionDelta < 0 || action.id.includes('work') || action.id.includes('study') || action.id === 'wait' || action.id === 'read' || action.id === 'toast' || action.id === 'photo' || action.id === 'email' || action.id === 'hide'
    this.noise = action.noise ?? (action.suspicionDelta > 10 ? 0.4 : 0)
    this.actionUses[action.id] = (this.actionUses[action.id] ?? 0) + 1

    if (this.level.id === 'office' && action.id === 'social') this.challengeBroken = true
    if (this.level.id === 'airport' && action.id === 'rush') this.challengeBroken = true

    audioSystem.play('action')
    hapticsSystem.tap()
    runtime.busyUntil = this.time.now + action.durationMs
    runtime.status.setText('…')

    // loading bar on card
    const width = GAME.width - 40
    runtime.fill.clear()

    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: action.durationMs,
      onUpdate: (tw) => {
        const v = tw.getValue() ?? 0
        runtime.fill.clear()
        runtime.fill.fillStyle(this.level.accent, 0.25)
        runtime.fill.fillRoundedRect(-width / 2 + 4, 28, (width - 8) * v, 6, 3)
      },
      onComplete: () => {
        runtime.fill.clear()
        this.resolveAction(runtime)
      },
    })
  }

  private resolveAction(runtime: ActionRuntime): void {
    const action = runtime.config
    this.progress = Phaser.Math.Clamp(this.progress + action.progressDelta, 0, this.level.targetProgress)
    const shield = { left: this.shieldLeft }
    this.suspicion.add(action.suspicionDelta, shield)
    this.shieldLeft = shield.left
    if (action.suspicionDelta > 0) {
      audioSystem.play('suspicion')
      this.cameras.main.shake(80, 0.004)
    }
    if (action.revealsNpc) {
      this.revealUntil = this.time.now + 2500
      this.awarenessText.setAlpha(1)
    }

    this.acting = false
    this.behaving = action.suspicionDelta <= 0
    this.noise = 0
    runtime.coolingUntil = this.time.now + action.cooldownMs
    runtime.status.setText('')

    this.burst(this.player.x, this.player.y - 20, action.progressDelta > 0 ? COLORS.success : COLORS.warn)
    this.checkEnd()
  }

  private burst(x: number, y: number, color: number): void {
    for (let i = 0; i < 8; i++) {
      const p = this.add.circle(x, y, 3, color, 0.9)
      this.tweens.add({
        targets: p,
        x: x + Phaser.Math.Between(-40, 40),
        y: y + Phaser.Math.Between(-40, 40),
        alpha: 0,
        duration: 400,
        onComplete: () => p.destroy(),
      })
    }
  }

  update(_t: number, dt: number): void {
    if (this.ended) return
    this.elapsed += dt / 1000
    this.timerText.setText(formatTime(this.elapsed))

    const { pressure, spotted, maxAwareness } = this.npcs.update(dt, this.acting, this.noise)
    const shield = { left: this.shieldLeft }
    // tick may add pressure — apply shield via a short path
    const before = this.suspicion.value
    this.suspicion.tick(dt / 1000, this.behaving && !this.acting, pressure * 4)
    if (this.suspicion.value > before && shield.left > 0) {
      const gain = this.suspicion.value - before
      const absorbed = Math.min(gain, shield.left)
      this.suspicion.add(-absorbed)
      shield.left -= absorbed
    }
    this.shieldLeft = shield.left

    if (spotted && this.acting) {
      const s = { left: this.shieldLeft }
      this.suspicion.add(0.35, s)
      this.shieldLeft = s.left
    }

    if (this.npcs.anyCaught()) {
      this.suspicion.add(100)
    }

    this.progressBar.set(this.progress / this.level.targetProgress, COLORS.success)
    this.suspicionBar.set(this.suspicion.ratio, suspicionColor(this.suspicion.ratio))
    this.suspicionBar.setTitle(
      this.suspicion.dangerLevel === 'critical'
        ? 'Suspicion — DANGER'
        : this.suspicion.dangerLevel === 'high'
          ? 'Suspicion — High'
          : 'Suspicion',
    )

    if (this.suspicion.dangerLevel === 'high' || this.suspicion.dangerLevel === 'critical') {
      if (!this.warningLatched) {
        this.warningLatched = true
        audioSystem.play('warning')
        hapticsSystem.warn()
      }
      this.flash.setAlpha(0.04 + Math.sin(this.time.now / 120) * 0.03)
      if (this.suspicion.dangerLevel === 'critical' && this.time.now % 400 < 20) {
        this.cameras.main.shake(40, 0.002)
      }
    } else {
      this.warningLatched = false
      this.flash.setAlpha(0)
    }

    // sync NPC views
    for (const npc of this.npcs.npcs) {
      const view = this.npcViews.get(npc.config.id)
      if (!view) continue
      view.setPosition(npc.x, npc.y)
      view.setRotation(npc.facing * 0.15)
      const meta = view as Phaser.GameObjects.Container & {
        stateText: Phaser.GameObjects.Text
        ring: Phaser.GameObjects.Arc
      }
      meta.stateText.setText(npc.state)
      meta.ring.setScale(npc.state === 'LOOKING' || npc.state === 'INVESTIGATING' ? 1.25 : 1)
      meta.ring.setAlpha(npc.state === 'SUSPICIOUS' || npc.state === 'INVESTIGATING' ? 0.45 : 0.15)
    }

    if (this.time.now < this.revealUntil) {
      this.awarenessText.setText(`Awareness ${Math.round(maxAwareness)}%`)
    } else {
      this.awarenessText.setAlpha(0)
    }

    // dim cooling cards
    for (const a of this.actions) {
      const cooling = this.time.now < a.coolingUntil
      const redraw = (a.card as Phaser.GameObjects.Container & { redraw?: (p: boolean, d: boolean) => void }).redraw
      if (redraw && cooling) a.status.setText('…')
      else if (!this.acting) a.status.setText('')
    }

    this.checkEnd()
  }

  private checkEnd(): void {
    if (this.ended) return
    if (this.progress >= this.level.targetProgress) {
      this.finish(true)
      return
    }
    if (this.suspicion.isCaught || this.npcs.anyCaught()) {
      this.finish(false)
    }
  }

  private challengeMet(): boolean {
    if (this.challengeBroken) return false
    switch (this.level.id) {
      case 'classroom':
        return this.suspicion.peak < 50
      case 'office':
        return !this.challengeBroken
      case 'library':
        return (this.actionUses['nibble'] ?? 0) >= 3
      case 'airport':
        return !this.challengeBroken
      case 'wedding':
        return this.suspicion.peak < 60
      default:
        return false
    }
  }

  private finish(success: boolean): void {
    if (this.ended) return
    this.ended = true
    if (success) {
      audioSystem.play('success')
      hapticsSystem.success()
      this.cameras.main.flash(250, 6, 214, 160)
    } else {
      audioSystem.play('failure')
      hapticsSystem.catch()
      this.cameras.main.shake(350, 0.02)
      this.flash.setFillStyle(0xef476f, 0.35)
    }

    this.time.delayedCall(450, () => {
      this.scene.start('Result', {
        levelId: this.level.id,
        success,
        timeSeconds: this.elapsed,
        peakSuspicion: this.suspicion.peak,
        challengeMet: success && this.challengeMet(),
      })
    })
  }

  private showPause(): void {
    if (this.ended) return
    this.scene.pause()
    const overlay = this.add.rectangle(GAME.width / 2, GAME.height / 2, GAME.width, GAME.height, 0x000000, 0.65).setDepth(200)
    const panel = this.add.graphics().setDepth(201)
    panel.fillStyle(COLORS.bgPanel, 1)
    panel.fillRoundedRect(48, 280, GAME.width - 96, 240, 20)
    const title = this.add
      .text(GAME.width / 2, 320, 'Paused', {
        fontFamily: FONT.display,
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: '900',
      })
      .setOrigin(0.5)
      .setDepth(202)

    const resume = createButton(this, {
      x: GAME.width / 2,
      y: 390,
      width: 200,
      height: 48,
      label: 'Resume',
      fill: COLORS.success,
      onClick: () => {
        ;[overlay, panel, title, resume, quit].forEach((o) => o.destroy())
        this.scene.resume()
      },
    })
    resume.setDepth(202)

    const quit = createButton(this, {
      x: GAME.width / 2,
      y: 460,
      width: 200,
      height: 48,
      label: 'Quit',
      fill: COLORS.accentHot,
      onClick: () => {
        this.scene.stop()
        this.scene.start('Menu')
      },
    })
    quit.setDepth(202)
  }

  /** Continue after catch via rewarded ad stub — wired from Result primarily. */
  async offerContinue(): Promise<boolean> {
    const res = await monetization.showRewardedAd('continue_after_catch')
    if (res.watched) {
      this.suspicion.add(-25)
      return true
    }
    return false
  }
}
