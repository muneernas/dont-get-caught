export type NpcState =
  | 'IDLE'
  | 'PATROLLING'
  | 'LOOKING'
  | 'SUSPICIOUS'
  | 'INVESTIGATING'
  | 'CAUGHT'

export interface ActionConfig {
  id: string
  label: string
  icon: string
  durationMs: number
  progressDelta: number
  suspicionDelta: number
  cooldownMs: number
  hint?: string
  revealsNpc?: boolean
  noise?: number
}

export interface NpcConfig {
  id: string
  name: string
  color: number
  homeX: number
  homeY: number
  detectionRadius: number
  moveSpeed: number
  lookIntervalMs: [number, number]
  patrolPoints?: { x: number; y: number }[]
  awareness: number
}

export interface LevelConfig {
  id: string
  order: number
  location: string
  title: string
  objective: string
  blurb: string
  catchHint: string
  unlockHint: string
  bgTop: number
  bgBottom: number
  accent: number
  targetProgress: number
  baseSuspicionDecay: number
  actions: ActionConfig[]
  npcs: NpcConfig[]
  rewards: {
    baseCoins: number
    cleanBonus: number
    challengeBonus: number
    challenge: string
  }
  starThresholds: {
    /** Max seconds for 3★ */
    threeStarSeconds: number
    /** Max peak suspicion for 3★ */
    threeStarPeakSuspicion: number
  }
  dailyChallengeText?: string
}
