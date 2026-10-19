import Phaser from 'phaser'
import { GAME } from '../config/theme'

export class SuspicionSystem {
  value = 0
  peak = 0
  private decayPerSec: number

  constructor(decayPerSec: number) {
    this.decayPerSec = decayPerSec
  }

  reset(decayPerSec: number): void {
    this.value = 0
    this.peak = 0
    this.decayPerSec = decayPerSec
  }

  add(delta: number, shieldAbsorb?: { left: number }): number {
    let applied = delta
    if (delta > 0 && shieldAbsorb && shieldAbsorb.left > 0) {
      const absorbed = Math.min(delta, shieldAbsorb.left)
      shieldAbsorb.left -= absorbed
      applied = delta - absorbed
    }
    this.value = Phaser.Math.Clamp(this.value + applied, 0, GAME.maxSuspicion)
    this.peak = Math.max(this.peak, this.value)
    return applied
  }

  /** Call each frame with delta seconds and whether player is "behaving". */
  tick(dt: number, behaving: boolean, proximityPressure: number): void {
    if (proximityPressure > 0) {
      this.add(proximityPressure * dt)
    } else if (behaving) {
      this.add(-this.decayPerSec * dt)
    } else {
      this.add(-this.decayPerSec * 0.35 * dt)
    }
  }

  get ratio(): number {
    return this.value / GAME.maxSuspicion
  }

  get isCaught(): boolean {
    return this.value >= GAME.maxSuspicion
  }

  get dangerLevel(): 'low' | 'mid' | 'high' | 'critical' {
    if (this.value >= 85) return 'critical'
    if (this.value >= 65) return 'high'
    if (this.value >= 35) return 'mid'
    return 'low'
  }
}
