import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import { audioSystem } from './AudioSystem'
import { hapticsSystem } from './HapticsSystem'

export type PromptKind = 'freeze' | 'eye' | 'footsteps'

export interface PromptResult {
  kind: PromptKind
  success: boolean
  suspicionDelta: number
}

/**
 * Occasional touch-friendly micro prompts. Not spammy — gated by cooldown.
 */
export class ReactivePrompts {
  private nextAt = 0
  private active = false
  private kind: PromptKind = 'freeze'
  private deadline = 0
  private freezeTouched = false
  private footSide: 'L' | 'R' = 'L'
  private chosen: 'L' | 'R' | null = null
  private eyeTapped = false
  private layer: Phaser.GameObjects.Container | null = null
  private onDone: ((r: PromptResult) => void) | null = null

  reset(now: number): void {
    this.clearUi()
    this.active = false
    this.nextAt = now + Phaser.Math.Between(7000, 11000)
  }

  get isActive(): boolean {
    return this.active
  }

  /** Blocks channeling while a prompt demands attention. */
  get blocksActions(): boolean {
    return this.active
  }

  tick(
    scene: Phaser.Scene,
    now: number,
    suspicion: number,
    watchFactor: number,
    onDone: (r: PromptResult) => void,
  ): void {
    if (this.active) {
      if (now >= this.deadline) this.resolve(scene, now)
      return
    }
    if (now < this.nextAt) return
    if (suspicion < 12 && watchFactor < 0.3) {
      this.nextAt = now + 2000
      return
    }
    // ~35% chance when timer fires; else defer
    if (Math.random() > 0.38) {
      this.nextAt = now + Phaser.Math.Between(2500, 5000)
      return
    }
    this.spawn(scene, now, onDone)
  }

  private spawn(scene: Phaser.Scene, now: number, onDone: (r: PromptResult) => void): void {
    const kinds: PromptKind[] = ['freeze', 'eye', 'footsteps']
    this.kind = kinds[Phaser.Math.Between(0, kinds.length - 1)]!
    this.active = true
    this.onDone = onDone
    this.freezeTouched = false
    this.eyeTapped = false
    this.chosen = null
    this.footSide = Math.random() < 0.5 ? 'L' : 'R'
    this.deadline = now + (this.kind === 'freeze' ? 1100 : 1300)

    audioSystem.play('warning')
    hapticsSystem.warn()

    const panel = scene.add.graphics()
    panel.fillStyle(0x0e1528, 0.82)
    panel.fillRoundedRect(24, 300, GAME.width - 48, 160, 18)
    panel.lineStyle(3, COLORS.accentHot, 0.9)
    panel.strokeRoundedRect(24, 300, GAME.width - 48, 160, 18)

    const title =
      this.kind === 'freeze'
        ? 'FREEZE!'
        : this.kind === 'eye'
          ? 'EYE CONTACT!'
          : 'FOOTSTEPS!'
    const hint =
      this.kind === 'freeze'
        ? 'Don’t touch anything…'
        : this.kind === 'eye'
          ? 'Tap NOW'
          : `Tap ${this.footSide === 'L' ? 'LEFT' : 'RIGHT'}`

    const t = scene.add
      .text(GAME.width / 2, 340, title, {
        fontFamily: FONT.display,
        fontSize: '28px',
        color: '#ef476f',
        fontStyle: '900',
      })
      .setOrigin(0.5)
    const h = scene.add
      .text(GAME.width / 2, 378, hint, {
        fontFamily: FONT.body,
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    const kids: Phaser.GameObjects.GameObject[] = [panel, t, h]

    if (this.kind === 'eye') {
      const btn = scene.add
        .rectangle(GAME.width / 2, 420, 200, 48, COLORS.accent, 1)
        .setInteractive({ useHandCursor: true })
      const bt = scene.add
        .text(GAME.width / 2, 420, 'LOOK BACK', {
          fontFamily: FONT.display,
          fontSize: '18px',
          color: '#ffffff',
          fontStyle: '800',
        })
        .setOrigin(0.5)
      btn.on('pointerdown', () => {
        this.eyeTapped = true
        this.resolve(scene, scene.time.now)
      })
      kids.push(btn, bt)
    } else if (this.kind === 'footsteps') {
      const mk = (side: 'L' | 'R', x: number) => {
        const b = scene.add
          .rectangle(x, 420, 120, 48, COLORS.info, 1)
          .setInteractive({ useHandCursor: true })
        const lab = scene.add
          .text(x, 420, side === 'L' ? 'LEFT' : 'RIGHT', {
            fontFamily: FONT.display,
            fontSize: '16px',
            color: '#ffffff',
            fontStyle: '800',
          })
          .setOrigin(0.5)
        b.on('pointerdown', () => {
          this.chosen = side
          this.resolve(scene, scene.time.now)
        })
        kids.push(b, lab)
      }
      mk('L', GAME.width / 2 - 80)
      mk('R', GAME.width / 2 + 80)
    } else {
      // Freeze: any pointer on game counts as fail
      scene.input.once('pointerdown', () => {
        if (this.active && this.kind === 'freeze') {
          this.freezeTouched = true
          this.resolve(scene, scene.time.now)
        }
      })
    }

    this.layer = scene.add.container(0, 0, kids)
    this.layer.setDepth(150)
  }

  private resolve(scene: Phaser.Scene, now: number): void {
    if (!this.active) return
    let success = false
    if (this.kind === 'freeze') success = !this.freezeTouched
    else if (this.kind === 'eye') success = this.eyeTapped
    else success = this.chosen === this.footSide

    const suspicionDelta = success
      ? this.kind === 'freeze'
        ? -8
        : -5
      : this.kind === 'freeze'
        ? 22
        : 18

    if (success) {
      audioSystem.play('success')
      hapticsSystem.success()
    } else {
      audioSystem.play('failure')
      hapticsSystem.catch()
      scene.cameras.main.shake(180, 0.012)
    }

    const result: PromptResult = { kind: this.kind, success, suspicionDelta }
    this.clearUi()
    this.active = false
    this.nextAt = now + Phaser.Math.Between(9000, 15000)
    this.onDone?.(result)
    this.onDone = null
  }

  private clearUi(): void {
    this.layer?.destroy(true)
    this.layer = null
  }
}
