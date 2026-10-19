import { mergeSave } from './merge/MergeSave'

type SfxName =
  | 'click'
  | 'action'
  | 'suspicion'
  | 'warning'
  | 'npc'
  | 'success'
  | 'failure'
  | 'coins'
  | 'star'

/** Lightweight WebAudio beeps — swap for real assets later. */
export class AudioSystem {
  private ctx: AudioContext | null = null
  private unlocked = false

  private ensure(): AudioContext | null {
    if (!mergeSave.data.settings.sound) return null
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AC()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    this.unlocked = true
    return this.ctx
  }

  unlock(): void {
    this.ensure()
  }

  play(name: SfxName): void {
    const ctx = this.ensure()
    if (!ctx || !this.unlocked) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    const profiles: Record<SfxName, { f: number; f2?: number; d: number; type: OscillatorType; vol: number }> = {
      click: { f: 520, d: 0.05, type: 'triangle', vol: 0.08 },
      action: { f: 340, f2: 520, d: 0.12, type: 'sine', vol: 0.1 },
      suspicion: { f: 180, f2: 140, d: 0.18, type: 'sawtooth', vol: 0.06 },
      warning: { f: 220, f2: 360, d: 0.25, type: 'square', vol: 0.07 },
      npc: { f: 150, f2: 110, d: 0.2, type: 'triangle', vol: 0.07 },
      success: { f: 440, f2: 660, d: 0.35, type: 'sine', vol: 0.12 },
      failure: { f: 160, f2: 90, d: 0.4, type: 'sawtooth', vol: 0.1 },
      coins: { f: 880, f2: 1200, d: 0.15, type: 'sine', vol: 0.09 },
      star: { f: 660, f2: 990, d: 0.2, type: 'triangle', vol: 0.1 },
    }

    const p = profiles[name]
    osc.type = p.type
    osc.frequency.setValueAtTime(p.f, now)
    if (p.f2) osc.frequency.exponentialRampToValueAtTime(p.f2, now + p.d)
    gain.gain.setValueAtTime(p.vol, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + p.d)
    osc.start(now)
    osc.stop(now + p.d + 0.02)
  }
}

export const audioSystem = new AudioSystem()
