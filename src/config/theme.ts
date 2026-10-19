export const COLORS = {
  bgDeep: 0x0e1528,
  bgNavy: 0x1a2744,
  bgPanel: 0x243556,
  accent: 0xff6b4a,
  accentHot: 0xef476f,
  gold: 0xffd166,
  success: 0x06d6a0,
  info: 0x4cc9f0,
  warn: 0xff9f1c,
  text: 0xffffff,
  textMuted: 0xa8b4c8,
  suspicionLow: 0x06d6a0,
  suspicionMid: 0xffd166,
  suspicionHigh: 0xef476f,
  card: 0x2d4263,
  cardPress: 0x3a5480,
  lock: 0x5a6578,
} as const

export const GAME = {
  width: 390,
  height: 844,
  maxProgress: 100,
  maxSuspicion: 100,
} as const

export const FONT = {
  display: '"Nunito", system-ui, sans-serif',
  body: '"Space Grotesk", system-ui, sans-serif',
} as const
