export type RiskTier = 'safe' | 'risky' | 'bold'

export interface RiskProfile {
  id: RiskTier
  label: string
  /** Multiplier on progress gain rate while channeling */
  progressMul: number
  /** Multiplier on suspicion from the action / mid-channel spikes */
  suspicionMul: number
  /** Extra noise while channeling */
  noise: number
  color: number
}

export const RISK_TIERS: Record<RiskTier, RiskProfile> = {
  safe: {
    id: 'safe',
    label: 'Safe',
    progressMul: 0.55,
    suspicionMul: 0.35,
    noise: 0.05,
    color: 0x06d6a0,
  },
  risky: {
    id: 'risky',
    label: 'Risky',
    progressMul: 1,
    suspicionMul: 1,
    noise: 0.35,
    color: 0xffd166,
  },
  bold: {
    id: 'bold',
    label: 'Bold',
    progressMul: 1.6,
    suspicionMul: 1.85,
    noise: 0.85,
    color: 0xef476f,
  },
}
