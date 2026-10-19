export interface StoryNode {
  id: string
  title: string
  /** Short snackable line after unlock */
  line: string
  starCost: number
  /** Position on story map (0–1 normalized) */
  x: number
  y: number
  /** Must unlock these first (empty = start) */
  requires: string[]
  /** Gameplay unlock flags */
  unlocks?: {
    generatorId?: string
    /** Flavor only for MVP, or gate higher order pool later */
    chainBoost?: string
    maxEnergyBonus?: number
  }
  emoji: string
  color: number
}

/** Haven story path — earn stars on board, spend here. */
export const STORY_NODES: StoryNode[] = [
  {
    id: 'gate',
    title: 'Rusty Gate',
    line: 'The latch gives. Haven remembers you.',
    starCost: 0,
    x: 0.5,
    y: 0.82,
    requires: [],
    emoji: '🚪',
    color: 0xc4b5e0,
  },
  {
    id: 'garden',
    title: 'Overgrown Garden',
    line: 'The garden wakes up… sprouts lean toward the sun.',
    starCost: 3,
    x: 0.28,
    y: 0.62,
    requires: ['gate'],
    unlocks: { generatorId: 'gen_crops' },
    emoji: '🌿',
    color: 0x4ade80,
  },
  {
    id: 'bridge',
    title: 'Broken Bridge',
    line: 'Planks settle. A neighbor waves from the far bank.',
    starCost: 5,
    x: 0.72,
    y: 0.58,
    requires: ['gate'],
    unlocks: { maxEnergyBonus: 10 },
    emoji: '🌉',
    color: 0x60a5fa,
  },
  {
    id: 'workshop',
    title: 'Dusty Workshop',
    line: 'Tools hum again. The Tool Crate is yours.',
    starCost: 4,
    x: 0.22,
    y: 0.38,
    requires: ['garden'],
    unlocks: { generatorId: 'gen_tools' },
    emoji: '🧰',
    color: 0xf59e0b,
  },
  {
    id: 'cafe',
    title: 'Closed Café',
    line: 'The espresso machine sighs. Orders get tastier rewards.',
    starCost: 8,
    x: 0.78,
    y: 0.36,
    requires: ['bridge'],
    unlocks: { chainBoost: 'orders_plus' },
    emoji: '☕',
    color: 0xfbbf24,
  },
  {
    id: 'cottage',
    title: 'Quiet Cottage',
    line: 'Curtains open. Someone left a thank-you note… and stars.',
    starCost: 12,
    x: 0.5,
    y: 0.18,
    requires: ['workshop', 'cafe'],
    unlocks: { maxEnergyBonus: 15 },
    emoji: '🏠',
    color: 0xff6b9d,
  },
]

export function storyNode(id: string): StoryNode | undefined {
  return STORY_NODES.find((n) => n.id === id)
}
