export type ChainId = 'tools' | 'crops'

export interface ItemDef {
  id: string
  chain: ChainId
  tier: number
  name: string
  emoji: string
  color: number
}

export interface GeneratorDef {
  id: string
  name: string
  emoji: string
  color: number
  energyCost: number
  cooldownMs: number
  /** Weighted spit outputs: item id */
  outputs: { itemId: string; weight: number }[]
}

export interface OrderTemplate {
  id: string
  needs: { itemId: string; qty: number }[]
  coins: number
  xp: number
}

const toolEmojis = ['🔩', '🔧', '🔨', '🪛', '⚙️', '🧰', '🏠']
const toolNames = ['Bolt', 'Wrench', 'Hammer', 'Driver', 'Gear', 'Toolbox', 'Workshop']
const toolColors = [0x94a3b8, 0x60a5fa, 0x38bdf8, 0x22d3ee, 0xa78bfa, 0xf59e0b, 0xf97316]

const cropEmojis = ['🌱', '🌿', '🌷', '🥕', '🍎', '🧺', '🌾']
const cropNames = ['Seed', 'Sprout', 'Bloom', 'Carrot', 'Apple', 'Basket', 'Harvest']
const cropColors = [0x86efac, 0x4ade80, 0xf9a8d4, 0xfb923c, 0xf87171, 0xd97706, 0xeab308]

function buildChain(chain: ChainId, names: string[], emojis: string[], colors: number[]): ItemDef[] {
  return names.map((name, i) => ({
    id: `${chain}_${i + 1}`,
    chain,
    tier: i + 1,
    name,
    emoji: emojis[i]!,
    color: colors[i]!,
  }))
}

export const ITEMS: ItemDef[] = [
  ...buildChain('tools', toolNames, toolEmojis, toolColors),
  ...buildChain('crops', cropNames, cropEmojis, cropColors),
]

export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]))

export function mergeResult(itemId: string): ItemDef | null {
  const item = ITEM_BY_ID[itemId]
  if (!item) return null
  return ITEMS.find((i) => i.chain === item.chain && i.tier === item.tier + 1) ?? null
}

export const GENERATORS: GeneratorDef[] = [
  {
    id: 'gen_tools',
    name: 'Tool Crate',
    emoji: '📦',
    color: 0x3b82f6,
    energyCost: 8,
    cooldownMs: 900,
    outputs: [
      { itemId: 'tools_1', weight: 55 },
      { itemId: 'tools_2', weight: 30 },
      { itemId: 'tools_3', weight: 15 },
    ],
  },
  {
    id: 'gen_crops',
    name: 'Seed Bag',
    emoji: 'Sack',
    color: 0x22c55e,
    energyCost: 7,
    cooldownMs: 800,
    outputs: [
      { itemId: 'crops_1', weight: 55 },
      { itemId: 'crops_2', weight: 30 },
      { itemId: 'crops_3', weight: 15 },
    ],
  },
]

// Fix seed bag emoji
GENERATORS[1]!.emoji = '🎒'

export const ORDER_POOL: OrderTemplate[] = [
  { id: 'o1', needs: [{ itemId: 'tools_2', qty: 1 }], coins: 25, xp: 12 },
  { id: 'o2', needs: [{ itemId: 'crops_2', qty: 1 }], coins: 22, xp: 10 },
  { id: 'o3', needs: [{ itemId: 'tools_3', qty: 1 }], coins: 45, xp: 22 },
  { id: 'o4', needs: [{ itemId: 'crops_3', qty: 1 }], coins: 40, xp: 20 },
  { id: 'o5', needs: [{ itemId: 'tools_2', qty: 1 }, { itemId: 'crops_2', qty: 1 }], coins: 55, xp: 28 },
  { id: 'o6', needs: [{ itemId: 'tools_4', qty: 1 }], coins: 80, xp: 40 },
  { id: 'o7', needs: [{ itemId: 'crops_4', qty: 1 }], coins: 75, xp: 38 },
  { id: 'o8', needs: [{ itemId: 'tools_3', qty: 1 }, { itemId: 'crops_3', qty: 1 }], coins: 95, xp: 48 },
  { id: 'o9', needs: [{ itemId: 'crops_5', qty: 1 }], coins: 120, xp: 60 },
  { id: 'o10', needs: [{ itemId: 'tools_5', qty: 1 }], coins: 130, xp: 65 },
]

export const BOARD_COLS = 6
export const BOARD_ROWS = 5
export const MAX_ENERGY = 100
export const ENERGY_REGEN_MS = 20_000
export const XP_PER_LEVEL = 100
