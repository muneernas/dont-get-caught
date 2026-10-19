import Phaser from 'phaser'
import type { LevelConfig } from '../data/levels'
import type { AttentionBand } from './AttentionSystem'
import type { NpcController } from './NpcController'

export interface MechanicFrame {
  /** Extra suspicion per second */
  suspicionPerSec: number
  /** Multiplier on channel progress (e.g. airport WAIT phase slows productive move) */
  progressMul: number
  /** Extra noise scale */
  noiseMul: number
  /** HUD line for signature mechanic */
  hudLine: string
  /** Force attention band override for tell (optional) */
  forceBand?: AttentionBand
}

/**
 * Per-level signature tension on top of the shared stealth loop.
 */
export class LevelMechanics {
  private level!: LevelConfig
  // Classroom: uncertain return
  private awayMs = 0
  private awayMax = 0
  private presentMs = 0
  // Library noise
  noise = 0
  // Airport scan phase
  private phase: 'MOVE' | 'WAIT' = 'WAIT'
  private phaseMs = 0
  // Office desk-check pulse
  private deskCheckUntil = 0

  init(level: LevelConfig): void {
    this.level = level
    this.noise = 0
    this.phase = 'WAIT'
    this.phaseMs = Phaser.Math.Between(1800, 3200)
    this.awayMax = Phaser.Math.Between(3500, 7000)
    this.awayMs = this.awayMax
    this.presentMs = 0
    this.deskCheckUntil = 0
  }

  /** Call when player channels a noisy/productive action. */
  addNoise(amount: number): void {
    if (this.level.id === 'library') {
      this.noise = Phaser.Math.Clamp(this.noise + amount * 40, 0, 100)
    }
  }

  tick(
    dtMs: number,
    npcs: NpcController,
    channeling: boolean,
    riskNoise: number,
    now: number,
  ): MechanicFrame {
    const dt = dtMs / 1000
    switch (this.level.id) {
      case 'classroom':
        return this.tickClassroom(dtMs, npcs)
      case 'office':
        return this.tickOffice(dtMs, npcs, now)
      case 'library':
        return this.tickLibrary(dt, channeling, riskNoise, npcs)
      case 'airport':
        return this.tickAirport(dtMs, channeling)
      case 'wedding':
        return this.tickWedding(npcs)
      default:
        return { suspicionPerSec: 0, progressMul: 1, noiseMul: 1, hudLine: '' }
    }
  }

  private tickClassroom(dtMs: number, npcs: NpcController): MechanicFrame {
    const teacher = npcs.npcs[0]
    if (!teacher) {
      return { suspicionPerSec: 0, progressMul: 1, noiseMul: 1, hudLine: 'Teacher…?' }
    }

    // Away → uncertain return window
    if (this.presentMs <= 0) {
      this.awayMs -= dtMs
      // Soft distract: teacher faces away while "gone"
      if (this.awayMs > 800) {
        teacher.state = teacher.state === 'INVESTIGATING' ? teacher.state : 'IDLE'
        teacher.facing = Math.PI // look away
      }
      if (this.awayMs <= 0) {
        this.presentMs = Phaser.Math.Between(2200, 4200)
        teacher.state = 'LOOKING'
        teacher.facing = Phaser.Math.Angle.Between(teacher.x, teacher.y, 195, 310)
        teacher.awareness = Math.max(teacher.awareness, 60)
      }
      const pct = Math.round((1 - this.awayMs / this.awayMax) * 100)
      return {
        suspicionPerSec: 0,
        progressMul: 1.1,
        noiseMul: 1,
        hudLine: this.awayMs < 1200 ? 'Teacher returning…?' : `Teacher away ~${Math.max(0, 100 - pct)}%`,
        forceBand: this.awayMs < 1200 ? 'UNCERTAIN' : 'CLEAR',
      }
    }

    this.presentMs -= dtMs
    if (this.presentMs <= 0) {
      this.awayMax = Phaser.Math.Between(4000, 8000)
      this.awayMs = this.awayMax
    }
    return {
      suspicionPerSec: 1.2,
      progressMul: 0.85,
      noiseMul: 1.2,
      hudLine: 'Teacher in the room!',
      forceBand: 'WATCHED',
    }
  }

  private tickOffice(dtMs: number, npcs: NpcController, now: number): MechanicFrame {
    if (now > this.deskCheckUntil && Math.random() < 0.002 * dtMs) {
      this.deskCheckUntil = now + 1600
      const boss = npcs.npcs[0]
      if (boss) {
        boss.state = 'LOOKING'
        boss.awareness = Math.min(100, boss.awareness + 25)
      }
    }
    const checking = now < this.deskCheckUntil
    return {
      suspicionPerSec: checking ? 3 : 0,
      progressMul: checking ? 0.7 : 1,
      noiseMul: 1,
      hudLine: checking ? 'Boss desk-check!' : 'Boss on patrol',
      forceBand: checking ? 'WATCHED' : undefined,
    }
  }

  private tickLibrary(
    dt: number,
    channeling: boolean,
    riskNoise: number,
    npcs: NpcController,
  ): MechanicFrame {
    if (channeling) this.noise = Phaser.Math.Clamp(this.noise + riskNoise * 28 * dt, 0, 100)
    else this.noise = Math.max(0, this.noise - 12 * dt)

    if (this.noise > 70) {
      const lib = npcs.npcs[0]
      if (lib && lib.state !== 'CAUGHT') {
        lib.state = 'INVESTIGATING'
        lib.awareness = Math.min(100, lib.awareness + 20 * dt)
      }
    }
    return {
      suspicionPerSec: this.noise > 55 ? (this.noise - 55) * 0.15 : 0,
      progressMul: 1,
      noiseMul: 1,
      hudLine: `Noise ${Math.round(this.noise)}%`,
      forceBand: this.noise > 75 ? 'DANGER' : this.noise > 45 ? 'UNCERTAIN' : undefined,
    }
  }

  private tickAirport(dtMs: number, channeling: boolean): MechanicFrame {
    this.phaseMs -= dtMs
    if (this.phaseMs <= 0) {
      this.phase = this.phase === 'MOVE' ? 'WAIT' : 'MOVE'
      this.phaseMs = Phaser.Math.Between(1600, 3200)
    }
    // WAIT: stay still; channeling (moving bag) is dangerous
    // MOVE: channel productive actions
    const channelingOnWait = channeling && this.phase === 'WAIT'
    const idleOnMove = !channeling && this.phase === 'MOVE'
    return {
      suspicionPerSec: channelingOnWait ? 14 : idleOnMove ? 2.5 : 0,
      progressMul: this.phase === 'MOVE' ? 1.25 : 0.45,
      noiseMul: 1,
      hudLine: this.phase === 'MOVE' ? 'SCAN: MOVE now' : 'SCAN: WAIT',
      forceBand: channelingOnWait ? 'WATCHED' : this.phase === 'WAIT' ? 'CLEAR' : 'UNCERTAIN',
    }
  }

  private tickWedding(npcs: NpcController): MechanicFrame {
    const looking = npcs.npcs.filter((n) =>
      ['LOOKING', 'SUSPICIOUS', 'INVESTIGATING'].includes(n.state),
    ).length
    return {
      suspicionPerSec: looking >= 2 ? 4 : looking === 1 ? 1.2 : 0,
      progressMul: looking >= 2 ? 0.75 : 1,
      noiseMul: 1,
      hudLine:
        looking === 0
          ? 'Relatives busy — slip!'
          : looking === 1
            ? '1 relative watching'
            : `${looking} relatives watching!`,
      forceBand: looking >= 2 ? 'DANGER' : looking === 1 ? 'WATCHED' : 'CLEAR',
    }
  }
}
