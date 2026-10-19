import type { LevelConfig } from '../data/levels'
import { saveSystem } from './SaveSystem'

export interface RewardBreakdown {
  base: number
  clean: number
  challenge: number
  streak: number
  nearMiss: number
  total: number
  stars: number
  score: number
  nearMissTier: 'none' | 'close' | 'too_close'
}

export class EconomySystem {
  computeStars(
    level: LevelConfig,
    timeSeconds: number,
    peakSuspicion: number,
    success: boolean,
  ): number {
    if (!success) return 0
    let stars = 1
    if (peakSuspicion <= level.starThresholds.threeStarPeakSuspicion + 20) stars = 2
    if (
      timeSeconds <= level.starThresholds.threeStarSeconds &&
      peakSuspicion <= level.starThresholds.threeStarPeakSuspicion
    ) {
      stars = 3
    }
    return stars
  }

  computeRewards(opts: {
    level: LevelConfig
    success: boolean
    timeSeconds: number
    peakSuspicion: number
    challengeMet: boolean
    nearMiss?: boolean
    recoveredFromHigh?: boolean
  }): RewardBreakdown {
    if (!opts.success) {
      return {
        base: 0,
        clean: 0,
        challenge: 0,
        streak: 0,
        nearMiss: 0,
        total: 0,
        stars: 0,
        score: 0,
        nearMissTier: 'none',
      }
    }
    const stars = this.computeStars(
      opts.level,
      opts.timeSeconds,
      opts.peakSuspicion,
      true,
    )
    const clean = opts.peakSuspicion < 40 ? opts.level.rewards.cleanBonus : 0
    const challenge = opts.challengeMet ? opts.level.rewards.challengeBonus : 0
    const streak = Math.min(40, saveSystem.snapshot.streak * 5)
    const base = opts.level.rewards.baseCoins + (stars - 1) * 10
    let nearMiss = 0
    let nearMissTier: RewardBreakdown['nearMissTier'] = 'none'
    if (opts.nearMiss && opts.peakSuspicion >= 85) {
      nearMiss = 55
      nearMissTier = 'too_close'
    } else if (opts.nearMiss && opts.peakSuspicion >= 70) {
      nearMiss = 35
      nearMissTier = 'close'
    } else if (opts.recoveredFromHigh) {
      nearMiss = 20
      nearMissTier = 'close'
    }
    const total = base + clean + challenge + streak + nearMiss
    const score = Math.round(
      1000 +
        stars * 250 -
        opts.timeSeconds * 4 -
        opts.peakSuspicion * 3 +
        (clean ? 150 : 0) +
        (challenge ? 200 : 0) +
        nearMiss * 4,
    )
    return {
      base,
      clean,
      challenge,
      streak,
      nearMiss,
      total,
      stars,
      score: Math.max(100, score),
      nearMissTier,
    }
  }
}

export const economySystem = new EconomySystem()
