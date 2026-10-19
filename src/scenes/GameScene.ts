import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import { getLevel, type ActionConfig, type LevelConfig } from '../data/levels'
import { LEVEL_BACKGROUNDS } from '../config/assets'
import { NpcController } from '../systems/NpcController'
import { SuspicionSystem } from '../systems/SuspicionSystem'
import { AttentionSystem, type AttentionBand } from '../systems/AttentionSystem'
import { LevelMechanics } from '../systems/LevelMechanics'
import { ReactivePrompts } from '../systems/ReactivePrompts'
import { RISK_TIERS, type RiskTier } from '../systems/RiskTiers'
import { audioSystem } from '../systems/AudioSystem'
import { hapticsSystem } from '../systems/HapticsSystem'
import { monetization } from '../monetization/stubs'
import { saveSystem } from '../systems/SaveSystem'
import { ProgressBar, suspicionColor } from '../ui/Bars'
import { createButton } from '../ui/Button'
import { createNpcView, createPlayerView, type CharacterView } from '../ui/Characters'
import { formatTime } from '../utils/format'

interface ActionRuntime {
  config: ActionConfig
  coolingUntil: number
  card: Phaser.GameObjects.Container
  fill: Phaser.GameObjects.Graphics
  status: Phaser.GameObjects.Text
  channelable: boolean
  holding: boolean
  channel: number
  risk: RiskTier
  riskLabels: Phaser.GameObjects.Text[]
}

export class GameScene extends Phaser.Scene {
  private levelId = 'classroom'
  private level!: LevelConfig
  private suspicion!: SuspicionSystem
  private npcs = new NpcController()
  private attention = new AttentionSystem()
  private mechanics = new LevelMechanics()
  private prompts = new ReactivePrompts()

  private progress = 0
  private elapsed = 0
  private ended = false
  private channeling = false
  private activeAction: ActionRuntime | null = null
  private noise = 0
  private actionUses: Record<string, number> = {}
  private challengeBroken = false
  private warningLatched = false
  private shieldLeft = 0
  private nearMissLatched = false
  private recoveredFromHigh = false
  private watchedSpikeCooldown = 0
  private globalRisk: RiskTier = 'risky'

  private progressBar!: ProgressBar
  private suspicionBar!: ProgressBar
  private timerText!: Phaser.GameObjects.Text
  private attentionText!: Phaser.GameObjects.Text
  private attentionBg!: Phaser.GameObjects.Graphics
  private mechText!: Phaser.GameObjects.Text
  private tipText!: Phaser.GameObjects.Text
  private npcViews: Map<string, CharacterView> = new Map()
  private playerView!: CharacterView
  private actions: ActionRuntime[] = []
  private flash!: Phaser.GameObjects.Rectangle
  private lastNpcPos: Map<string, { x: number; y: number }> = new Map()
  private truthBand: AttentionBand = 'CLEAR'
  private watchFactor = 0

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
    this.channeling = false
    this.activeAction = null
    this.noise = 0
    this.actionUses = {}
    this.challengeBroken = false
    this.warningLatched = false
    this.nearMissLatched = false
    this.recoveredFromHigh = false
    this.watchedSpikeCooldown = 0
    this.globalRisk = 'risky'
    this.actions = []
    this.npcViews.clear()
    this.lastNpcPos.clear()
    this.attention.reset()
    this.mechanics.init(level)
    this.prompts.reset(this.time.now)

    const bgKey = LEVEL_BACKGROUNDS[level.id] ?? 'bg_classroom'
    const bg = this.add.image(GAME.width / 2, GAME.height / 2, bgKey)
    bg.setDisplaySize(GAME.width, GAME.height)
    bg.setAlpha(0.9)

    const veil = this.add.graphics()
    veil.fillStyle(0x0e1528, 0.4)
    veil.fillRect(0, 0, GAME.width, 210)
    veil.fillStyle(0x0e1528, 0.58)
    veil.fillRect(0, 390, GAME.width, GAME.height - 390)

    const stage = this.add.graphics()
    stage.fillStyle(0x000000, 0.2)
    stage.fillRoundedRect(10, 188, GAME.width - 20, 190, 22)
    stage.lineStyle(2, level.accent, 0.4)
    stage.strokeRoundedRect(10, 188, GAME.width - 20, 190, 22)

    this.add
      .text(24, 32, level.location.toUpperCase(), {
        fontFamily: FONT.body,
        fontSize: '11px',
        color: '#ffd166',
        stroke: '#0e1528',
        strokeThickness: 3,
      })
    this.add.text(24, 48, level.objective, {
      fontFamily: FONT.display,
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: '800',
      wordWrap: { width: GAME.width - 100 },
      stroke: '#0e1528',
      strokeThickness: 3,
    })

    this.timerText = this.add
      .text(GAME.width - 24, 32, '0:00', {
        fontFamily: FONT.body,
        fontSize: '13px',
        color: '#ffffff',
        stroke: '#0e1528',
        strokeThickness: 3,
      })
      .setOrigin(1, 0)

    this.progressBar = new ProgressBar(this, GAME.width / 2, 100, GAME.width - 48, 16, COLORS.success, 'Progress')
    this.suspicionBar = new ProgressBar(
      this,
      GAME.width / 2,
      134,
      GAME.width - 48,
      16,
      COLORS.suspicionLow,
      'Suspicion',
    )

    this.attentionBg = this.add.graphics()
    this.attentionText = this.add
      .text(GAME.width / 2, 168, 'CLEAR — go!', {
        fontFamily: FONT.display,
        fontSize: '15px',
        color: '#ffffff',
        fontStyle: '800',
      })
      .setOrigin(0.5)

    this.mechText = this.add
      .text(GAME.width / 2, 186, '', {
        fontFamily: FONT.body,
        fontSize: '12px',
        color: '#a8b4c8',
        stroke: '#0e1528',
        strokeThickness: 3,
      })
      .setOrigin(0.5)

    this.tipText = this.add
      .text(GAME.width / 2, 396, 'Hold actions · release early to cancel · watch the tell', {
        fontFamily: FONT.body,
        fontSize: '11px',
        color: '#a8b4c8',
      })
      .setOrigin(0.5)

    this.npcs.init(level)
    this.npcs.setPlayer(GAME.width / 2, 310)
    for (const npc of this.npcs.npcs) {
      const view = createNpcView(this, npc.config.id, npc.config.name, npc.config.color)
      view.container.setPosition(npc.x, npc.y)
      this.npcViews.set(npc.config.id, view)
      this.lastNpcPos.set(npc.config.id, { x: npc.x, y: npc.y })
    }

    this.playerView = createPlayerView(this)
    this.playerView.container.setPosition(GAME.width / 2, 310)

    this.buildRiskStrip()
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

  private buildRiskStrip(): void {
    const y = 418
    const tiers: RiskTier[] = ['safe', 'risky', 'bold']
    tiers.forEach((tier, i) => {
      const x = 70 + i * 120
      const profile = RISK_TIERS[tier]
      createButton(this, {
        x,
        y,
        width: 100,
        height: 34,
        label: profile.label,
        fill: profile.color,
        fontSize: 14,
        onClick: () => {
          if (this.channeling) return
          this.globalRisk = tier
          this.tipText.setText(
            tier === 'safe'
              ? 'Safe: slow & quiet'
              : tier === 'bold'
                ? 'Bold: fast & loud — push your luck'
                : 'Risky: balanced speed',
          )
          audioSystem.play('click')
        },
      })
    })
  }

  private isChannelable(a: ActionConfig): boolean {
    if (a.instant) return false
    if (a.channel === false) return false
    if (a.channel === true) return true
    return a.progressDelta > 0
  }

  private buildActionCards(): void {
    const startY = 458
    const cardH = 64
    const gap = 6
    this.level.actions.forEach((action, i) => {
      const y = startY + i * (cardH + gap)
      const width = GAME.width - 40
      const channelable = this.isChannelable(action)
      const bg = this.add.graphics()
      const draw = (pressed: boolean, dimmed: boolean) => {
        bg.clear()
        bg.fillStyle(dimmed ? 0x1c2436 : pressed ? COLORS.cardPress : COLORS.card, 1)
        bg.fillRoundedRect(-width / 2, -cardH / 2, width, cardH, 14)
        bg.lineStyle(2, this.level.accent, dimmed ? 0.15 : 0.45)
        bg.strokeRoundedRect(-width / 2, -cardH / 2, width, cardH, 14)
      }
      draw(false, false)
      const fill = this.add.graphics()
      const icon = this.add.text(-width / 2 + 14, -4, action.icon, { fontSize: '22px' }).setOrigin(0, 0.5)
      const title = this.add
        .text(-width / 2 + 48, -12, action.label, {
          fontFamily: FONT.display,
          fontSize: '15px',
          color: '#ffffff',
          fontStyle: '800',
        })
        .setOrigin(0, 0.5)
      const hint = this.add
        .text(
          -width / 2 + 48,
          10,
          channelable
            ? `HOLD · ${action.hint ?? `+${action.progressDelta}%`}`
            : (action.hint ?? 'Tap'),
          {
            fontFamily: FONT.body,
            fontSize: '11px',
            color: '#a8b4c8',
          },
        )
        .setOrigin(0, 0.5)
      const status = this.add
        .text(width / 2 - 12, 0, '', {
          fontFamily: FONT.body,
          fontSize: '11px',
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
        card,
        fill,
        status,
        channelable,
        holding: false,
        channel: 0,
        risk: 'risky',
        riskLabels: [],
      }
      this.actions.push(runtime)

      hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (this.ended || this.prompts.blocksActions) return
        if (this.time.now < runtime.coolingUntil) return
        if (this.channeling && this.activeAction !== runtime) return
        draw(true, false)
        this.tweens.add({ targets: card, scale: 0.98, duration: 50 })
        if (channelable) this.beginChannel(runtime, pointer)
        else this.tapUtility(runtime)
      })
      hit.on('pointerup', () => {
        draw(false, false)
        this.tweens.add({ targets: card, scale: 1, duration: 70 })
        if (runtime.holding) this.endChannel(runtime, false)
      })
      hit.on('pointerout', () => {
        draw(false, this.time.now < runtime.coolingUntil)
        card.setScale(1)
        if (runtime.holding) this.endChannel(runtime, false)
      })
    })
  }

  private beginChannel(runtime: ActionRuntime, _pointer: Phaser.Input.Pointer): void {
    if (this.channeling) return
    runtime.holding = true
    runtime.channel = 0
    runtime.risk = this.globalRisk
    this.channeling = true
    this.activeAction = runtime
    this.noise = RISK_TIERS[runtime.risk].noise + (runtime.config.noise ?? 0) * 0.5
    this.actionUses[runtime.config.id] = (this.actionUses[runtime.config.id] ?? 0) + 1
    if (this.level.id === 'office' && runtime.config.id === 'social') this.challengeBroken = true
    if (this.level.id === 'airport' && runtime.config.id === 'rush') this.challengeBroken = true
    audioSystem.play('action')
    hapticsSystem.tap()
    runtime.status.setText(RISK_TIERS[runtime.risk].label)
    this.playerView.setPose('talk')
  }

  private endChannel(runtime: ActionRuntime, completed: boolean): void {
    if (!runtime.holding) return
    runtime.holding = false
    this.channeling = false
    this.activeAction = null
    this.noise = 0
    runtime.fill.clear()

    const portion = Phaser.Math.Clamp(runtime.channel, 0, 1)
    const risk = RISK_TIERS[runtime.risk]
    const progressGain = runtime.config.progressDelta * portion * risk.progressMul
    // Cancel early keeps partial progress — the skill
    this.progress = Phaser.Math.Clamp(this.progress + progressGain, 0, this.level.targetProgress)

    let sus = runtime.config.suspicionDelta * portion * risk.suspicionMul
    if (!completed && portion > 0.15 && portion < 0.95) {
      // Smart cancel: slightly less suspicion than finishing under watch
      sus *= 0.65
      runtime.status.setText('cut!')
    } else if (completed) {
      runtime.status.setText('done')
    }

    const shield = { left: this.shieldLeft }
    this.suspicion.add(sus, shield)
    this.shieldLeft = shield.left
    this.mechanics.addNoise(risk.noise * portion)

    if (sus > 4) {
      audioSystem.play('suspicion')
      this.cameras.main.shake(70, 0.004)
    }
    if (runtime.config.revealsNpc) {
      this.tipText.setText('Eyes open — read the tell')
    }

    runtime.coolingUntil = this.time.now + runtime.config.cooldownMs * (completed ? 1 : 0.6)
    this.playerView.setPose(sus <= 0 ? 'duck' : 'idle')
    this.time.delayedCall(400, () => {
      if (!this.channeling) runtime.status.setText('')
      this.playerView.setPose('idle')
    })
    this.burst(
      this.playerView.container.x,
      this.playerView.container.y - 40,
      progressGain > 0 ? COLORS.success : COLORS.warn,
    )
    this.checkEnd()
  }

  private tapUtility(runtime: ActionRuntime): void {
    if (this.channeling) return
    const action = runtime.config
    this.actionUses[action.id] = (this.actionUses[action.id] ?? 0) + 1
    audioSystem.play('action')
    hapticsSystem.tap()

    const shield = { left: this.shieldLeft }
    // Utilities are safer when CLEAR, riskier when WATCHED
    let sus = action.suspicionDelta
    if (sus < 0 && (this.truthBand === 'WATCHED' || this.truthBand === 'DANGER')) {
      sus *= 0.45 // cooling off while watched is weak
    }
    if (sus > 0 && this.truthBand === 'CLEAR') sus *= 0.7
    this.suspicion.add(sus, shield)
    this.shieldLeft = shield.left
    this.progress = Phaser.Math.Clamp(
      this.progress + action.progressDelta * 0.35,
      0,
      this.level.targetProgress,
    )

    if (action.revealsNpc) {
      this.tipText.setText(`Tell lag: trust carefully · ${this.attentionText.text}`)
    }
    runtime.coolingUntil = this.time.now + action.cooldownMs
    runtime.status.setText('ok')
    this.playerView.setPose(sus < 0 ? 'duck' : 'think')
    this.time.delayedCall(350, () => {
      runtime.status.setText('')
      this.playerView.setPose('idle')
    })
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

  private drawAttentionPill(band: AttentionBand, label: string, color: number): void {
    this.attentionBg.clear()
    this.attentionBg.fillStyle(color, 0.9)
    this.attentionBg.fillRoundedRect(GAME.width / 2 - 110, 154, 220, 28, 12)
    this.attentionText.setText(label)
    this.attentionText.setColor('#0e1528')
    void band
  }

  update(_t: number, dt: number): void {
    if (this.ended) return
    this.elapsed += dt / 1000
    this.timerText.setText(formatTime(this.elapsed))
    const now = this.time.now

    // NPC AI first, then signature mechanics can override tells/states
    const { pressure, spotted, maxAwareness } = this.npcs.update(
      dt,
      this.channeling,
      this.noise,
    )
    void maxAwareness

    const mech = this.mechanics.tick(dt, this.npcs, this.channeling, this.noise, now)
    this.mechText.setText(mech.hudLine)

    const truth = this.attention.truth(this.npcs.npcs)
    this.watchFactor = truth.watchFactor
    this.truthBand = mech.forceBand ?? truth.band
    const hud = this.attention.update(dt, this.truthBand, now)
    this.drawAttentionPill(hud.band, hud.label, hud.color)

    // Channel progress while holding
    if (this.channeling && this.activeAction) {
      const runtime = this.activeAction
      const risk = RISK_TIERS[runtime.risk]
      const baseDur = Math.max(900, runtime.config.durationMs)
      const rate = (dt / baseDur) * risk.progressMul * mech.progressMul
      // Faster when CLEAR, slower when watched
      const windowMul =
        this.truthBand === 'CLEAR' ? 1.15 : this.truthBand === 'UNCERTAIN' ? 0.9 : 0.55
      runtime.channel = Phaser.Math.Clamp(runtime.channel + rate * windowMul, 0, 1)

      const width = GAME.width - 40
      runtime.fill.clear()
      runtime.fill.fillStyle(risk.color, 0.45)
      runtime.fill.fillRoundedRect(-width / 2 + 4, 22, (width - 8) * runtime.channel, 7, 3)

      // Mid-channel spike if truth is watched (even if HUD lags)
      if (
        (this.truthBand === 'WATCHED' || this.truthBand === 'DANGER' || spotted) &&
        now > this.watchedSpikeCooldown
      ) {
        const spike = (6 + risk.suspicionMul * 5) * (dt / 1000) * 18
        const shield = { left: this.shieldLeft }
        this.suspicion.add(spike, shield)
        this.shieldLeft = shield.left
        this.flash.setAlpha(0.08)
        if (runtime.channel > 0.2 && this.truthBand === 'DANGER') {
          // Forced interrupt on danger
          this.endChannel(runtime, false)
          this.tipText.setText('Busted mid-act — cancel sooner!')
          audioSystem.play('warning')
          hapticsSystem.warn()
          this.cameras.main.shake(120, 0.01)
        }
        this.watchedSpikeCooldown = now + 120
      }

      if (runtime.channel >= 1) {
        this.endChannel(runtime, true)
      }
    }

    // Suspicion tick
    const behaving = !this.channeling && this.truthBand !== 'DANGER'
    const shield = { left: this.shieldLeft }
    const before = this.suspicion.value
    const pressureMul = this.channeling ? 5.5 : 3.2
    this.suspicion.tick(dt / 1000, behaving, pressure * pressureMul)
    this.suspicion.add(mech.suspicionPerSec * (dt / 1000), shield)
    if (this.suspicion.value > before && shield.left > 0) {
      const gain = this.suspicion.value - before
      const absorbed = Math.min(gain, shield.left)
      this.suspicion.add(-absorbed)
      shield.left -= absorbed
    }
    this.shieldLeft = shield.left

    if (this.npcs.anyCaught()) this.suspicion.add(100)

    // Near-miss tracking
    if (this.suspicion.value >= 70 && this.suspicion.value < 100) {
      this.nearMissLatched = true
    }
    if (this.nearMissLatched && this.suspicion.value < 55) {
      this.recoveredFromHigh = true
      if (this.tipText.text.indexOf('TOO CLOSE') < 0) {
        this.tipText.setText('TOO CLOSE — you recovered!')
        audioSystem.play('success')
        hapticsSystem.success()
      }
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
      this.flash.setAlpha(0.05 + Math.sin(now / 100) * 0.04)
      if (this.suspicion.dangerLevel === 'critical' && now % 400 < 20) {
        this.cameras.main.shake(40, 0.0025)
      }
    } else if (!this.channeling || this.truthBand === 'CLEAR') {
      this.warningLatched = false
      this.flash.setAlpha(Math.max(0, this.flash.alpha - 0.02))
    }

    for (const npc of this.npcs.npcs) {
      const view = this.npcViews.get(npc.config.id)
      if (!view) continue
      const prev = this.lastNpcPos.get(npc.config.id) ?? { x: npc.x, y: npc.y }
      const moving = Phaser.Math.Distance.Between(prev.x, prev.y, npc.x, npc.y) > 0.4
      this.lastNpcPos.set(npc.config.id, { x: npc.x, y: npc.y })
      view.container.setPosition(npc.x, npc.y)
      view.setNpcVisual(npc.state, npc.facing, moving)
    }

    this.prompts.tick(this, now, this.suspicion.value, this.watchFactor, (r) => {
      const s = { left: this.shieldLeft }
      this.suspicion.add(r.suspicionDelta, s)
      this.shieldLeft = s.left
      this.tipText.setText(r.success ? 'Clutch!' : 'Prompt failed — heat up')
      this.checkEnd()
    })

    for (const a of this.actions) {
      if (this.time.now < a.coolingUntil && !a.holding) a.status.setText('…')
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
    if (this.activeAction?.holding) this.endChannel(this.activeAction, false)

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
        nearMiss: success && this.nearMissLatched,
        recoveredFromHigh: success && this.recoveredFromHigh,
      })
    })
  }

  private showPause(): void {
    if (this.ended) return
    this.scene.pause()
    const overlay = this.add
      .rectangle(GAME.width / 2, GAME.height / 2, GAME.width, GAME.height, 0x000000, 0.65)
      .setDepth(200)
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

  async offerContinue(): Promise<boolean> {
    const res = await monetization.showRewardedAd('continue_after_catch')
    if (res.watched) {
      this.suspicion.add(-25)
      return true
    }
    return false
  }
}
