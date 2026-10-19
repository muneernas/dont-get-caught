import Phaser from 'phaser'
import type { NpcRuntime } from './NpcController'

export type AttentionBand = 'CLEAR' | 'UNCERTAIN' | 'WATCHED' | 'DANGER'

export interface AttentionSnapshot {
  band: AttentionBand
  watchFactor: number
  label: string
  color: number
  focusName: string
  tellLagging: boolean
}

/**
 * Turns NPC states into a readable (but imperfect) attention clock.
 * Real danger can lead the HUD by a short lag so timing stays skillful.
 */
export class AttentionSystem {
  private displayed: AttentionBand = 'CLEAR'
  private lagMs = 0
  private pending: AttentionBand | null = null
  private flickerUntil = 0

  reset(): void {
    this.displayed = 'CLEAR'
    this.lagMs = 0
    this.pending = null
    this.flickerUntil = 0
  }

  truth(npcs: NpcRuntime[]): { band: AttentionBand; watchFactor: number; focusName: string } {
    let watchFactor = 0
    let focusName = ''
    let band: AttentionBand = 'CLEAR'

    for (const npc of npcs) {
      let local = 0
      if (npc.state === 'CAUGHT' || npc.state === 'INVESTIGATING') {
        local = 1
        band = 'DANGER'
      } else if (npc.state === 'SUSPICIOUS') {
        local = 0.75
        if (band !== 'DANGER') band = 'WATCHED'
      } else if (npc.state === 'LOOKING') {
        local = 0.55
        if (band === 'CLEAR' || band === 'UNCERTAIN') band = 'WATCHED'
      } else if (npc.state === 'PATROLLING' && npc.awareness > 45) {
        local = 0.25
        if (band === 'CLEAR') band = 'UNCERTAIN'
      } else if (npc.state === 'IDLE' || npc.state === 'PATROLLING') {
        local = 0.05
      }
      if (local > watchFactor) {
        watchFactor = local
        focusName = npc.config.name
      }
    }

    return { band, watchFactor, focusName }
  }

  update(dtMs: number, truthBand: AttentionBand, now: number): AttentionSnapshot {
    if (truthBand !== this.displayed && truthBand !== this.pending) {
      this.pending = truthBand
      const rising = rank(truthBand) > rank(this.displayed)
      this.lagMs = rising ? Phaser.Math.Between(280, 700) : Phaser.Math.Between(80, 220)
      if (rising && Math.random() < 0.18) {
        this.flickerUntil = now + Phaser.Math.Between(200, 450)
      }
    }

    if (this.pending) {
      this.lagMs -= dtMs
      if (this.lagMs <= 0) {
        this.displayed = this.pending
        this.pending = null
      }
    }

    let shown = this.displayed
    if (now < this.flickerUntil && rank(truthBand) > rank(shown)) {
      shown = 'CLEAR'
    }

    return {
      band: shown,
      watchFactor: 0,
      label: labelFor(shown),
      color: colorFor(shown),
      focusName: '',
      tellLagging: !!this.pending || now < this.flickerUntil,
    }
  }
}

function rank(b: AttentionBand): number {
  switch (b) {
    case 'CLEAR':
      return 0
    case 'UNCERTAIN':
      return 1
    case 'WATCHED':
      return 2
    case 'DANGER':
      return 3
  }
}

function labelFor(b: AttentionBand): string {
  switch (b) {
    case 'CLEAR':
      return 'CLEAR — go!'
    case 'UNCERTAIN':
      return '… unsure'
    case 'WATCHED':
      return 'LOOKING!'
    case 'DANGER':
      return 'COMING!'
  }
}

function colorFor(b: AttentionBand): number {
  switch (b) {
    case 'CLEAR':
      return 0x06d6a0
    case 'UNCERTAIN':
      return 0xffd166
    case 'WATCHED':
      return 0xff9f1c
    case 'DANGER':
      return 0xef476f
  }
}
