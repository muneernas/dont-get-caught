import {
  BASE_MAX_ENERGY,
  ENERGY_REGEN_MS,
  GENERATORS,
  ORDER_POOL,
  XP_PER_LEVEL,
} from '../../data/merge/items'
import { STORY_NODES } from '../../data/merge/story'
import { BoardModel, type CellItem } from './BoardModel'

export interface ActiveOrder {
  templateId: string
  needs: { itemId: string; qty: number }[]
  coins: number
  xp: number
  stars: number
}

export interface MergeSaveData {
  version: number
  coins: number
  stars: number
  energy: number
  energyUpdatedAt: number
  xp: number
  level: number
  board: (CellItem | null)[]
  generatorReadyAt: Record<string, number>
  orders: ActiveOrder[]
  unlockedStory: string[]
  settings: { sound: boolean; haptics: boolean; music: boolean }
  dailyClaimed: string
  adsRemoved: boolean
  totalMerges: number
  totalOrders: number
  /** Story flag: café boosts order star payout */
  ordersPlus: boolean
}

const KEY = 'dgc_merge_v2'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function chainAvailable(itemId: string, unlockedStory: string[]): boolean {
  if (itemId.startsWith('crops_')) return unlockedStory.includes('garden')
  if (itemId.startsWith('tools_')) return unlockedStory.includes('workshop')
  return true
}

function pickOrders(n: number, avoid: string[] = [], unlockedStory: string[] = ['gate', 'garden']): ActiveOrder[] {
  const pool = ORDER_POOL.filter(
    (o) =>
      !avoid.includes(o.id) && o.needs.every((need) => chainAvailable(need.itemId, unlockedStory)),
  )
  const use = pool.length ? pool : ORDER_POOL.filter((o) => o.needs.every((n) => n.itemId.startsWith('crops_')))
  const shuffled = [...use].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n).map((o) => ({
    templateId: o.id,
    needs: o.needs.map((x) => ({ ...x })),
    coins: o.coins,
    xp: o.xp,
    stars: o.stars,
  }))
}

function defaultSave(): MergeSaveData {
  const board = new BoardModel()
  board.spawn('crops_1')
  board.spawn('crops_1')
  board.spawn('crops_2')
  return {
    version: 2,
    coins: 40,
    stars: 2, // starter so story feels reachable
    energy: BASE_MAX_ENERGY,
    energyUpdatedAt: Date.now(),
    xp: 0,
    level: 1,
    board: board.serialize(),
    generatorReadyAt: Object.fromEntries(GENERATORS.map((g) => [g.id, 0])),
    unlockedStory: ['gate', 'garden'],
    orders: pickOrders(3, [], ['gate', 'garden']),
    settings: { sound: true, haptics: true, music: true },
    dailyClaimed: '',
    adsRemoved: false,
    totalMerges: 0,
    totalOrders: 0,
    ordersPlus: false,
  }
}

export class MergeSave {
  data: MergeSaveData

  constructor() {
    this.data = this.load()
    this.regenEnergy()
  }

  private load(): MergeSaveData {
    try {
      const raw = localStorage.getItem(KEY) ?? localStorage.getItem('dgc_merge_v1')
      if (!raw) return defaultSave()
      const parsed = JSON.parse(raw) as Partial<MergeSaveData>
      const base = defaultSave()
      const merged: MergeSaveData = {
        ...base,
        ...parsed,
        settings: { ...base.settings, ...parsed.settings },
        unlockedStory: parsed.unlockedStory?.length ? parsed.unlockedStory : base.unlockedStory,
        stars: parsed.stars ?? base.stars,
        ordersPlus: parsed.ordersPlus ?? false,
        version: 2,
      }
      // migrate orders missing stars
      merged.orders = (parsed.orders ?? base.orders).map((o) => ({
        ...o,
        stars: o.stars ?? 1,
      }))
      return merged
    } catch {
      return defaultSave()
    }
  }

  persist(): void {
    localStorage.setItem(KEY, JSON.stringify(this.data))
  }

  maxEnergy(): number {
    let bonus = 0
    for (const id of this.data.unlockedStory) {
      const node = STORY_NODES.find((n) => n.id === id)
      bonus += node?.unlocks?.maxEnergyBonus ?? 0
    }
    return BASE_MAX_ENERGY + bonus
  }

  isGeneratorUnlocked(genId: string): boolean {
    const gen = GENERATORS.find((g) => g.id === genId)
    if (!gen?.unlockNode) return true
    return this.data.unlockedStory.includes(gen.unlockNode)
  }

  canUnlockStory(nodeId: string): { ok: boolean; reason?: string } {
    const node = STORY_NODES.find((n) => n.id === nodeId)
    if (!node) return { ok: false, reason: 'Unknown' }
    if (this.data.unlockedStory.includes(nodeId)) return { ok: false, reason: 'Already restored' }
    for (const req of node.requires) {
      if (!this.data.unlockedStory.includes(req)) return { ok: false, reason: 'Locked path' }
    }
    if (this.data.stars < node.starCost) return { ok: false, reason: 'Need more stars' }
    return { ok: true }
  }

  unlockStory(nodeId: string): { ok: boolean; line?: string; reason?: string } {
    const check = this.canUnlockStory(nodeId)
    if (!check.ok) return check
    const node = STORY_NODES.find((n) => n.id === nodeId)!
    this.data.stars -= node.starCost
    this.data.unlockedStory.push(nodeId)
    if (node.unlocks?.chainBoost === 'orders_plus') this.data.ordersPlus = true
    // top off a bit of energy on repair
    this.data.energy = Math.min(this.maxEnergy(), this.data.energy + 15)
    this.persist()
    return { ok: true, line: node.line }
  }

  regenEnergy(): void {
    const max = this.maxEnergy()
    const now = Date.now()
    if (this.data.energy >= max) {
      this.data.energyUpdatedAt = now
      return
    }
    const elapsed = now - this.data.energyUpdatedAt
    const gained = Math.floor(elapsed / ENERGY_REGEN_MS)
    if (gained > 0) {
      this.data.energy = Math.min(max, this.data.energy + gained)
      this.data.energyUpdatedAt += gained * ENERGY_REGEN_MS
      this.persist()
    }
  }

  msToNextEnergy(): number {
    this.regenEnergy()
    if (this.data.energy >= this.maxEnergy()) return 0
    return Math.max(0, ENERGY_REGEN_MS - (Date.now() - this.data.energyUpdatedAt))
  }

  spendEnergy(n: number): boolean {
    this.regenEnergy()
    if (this.data.energy < n) return false
    this.data.energy -= n
    this.persist()
    return true
  }

  addCoins(n: number): void {
    this.data.coins = Math.max(0, this.data.coins + n)
    this.persist()
  }

  addStars(n: number): void {
    this.data.stars = Math.max(0, this.data.stars + n)
    this.persist()
  }

  spendCoins(n: number): boolean {
    if (this.data.coins < n) return false
    this.data.coins -= n
    this.persist()
    return true
  }

  addXp(n: number): boolean {
    this.data.xp += n
    let leveled = false
    while (this.data.xp >= XP_PER_LEVEL) {
      this.data.xp -= XP_PER_LEVEL
      this.data.level += 1
      leveled = true
      this.data.coins += 20
      this.data.stars += 1
    }
    this.persist()
    return leveled
  }

  refillEnergyFull(): void {
    this.data.energy = this.maxEnergy()
    this.data.energyUpdatedAt = Date.now()
    this.persist()
  }

  claimDaily(): number | null {
    if (this.data.dailyClaimed === today()) return null
    this.data.dailyClaimed = today()
    const reward = 50
    this.addCoins(reward)
    this.addStars(1)
    return reward
  }

  replaceOrder(index: number): void {
    const avoid = this.data.orders.map((o) => o.templateId)
    const next = pickOrders(1, avoid, this.data.unlockedStory)[0]
    if (next) this.data.orders[index] = next
    this.persist()
  }

  completeOrder(index: number): ActiveOrder | null {
    const order = this.data.orders[index]
    if (!order) return null
    this.data.totalOrders += 1
    const starMul = this.data.ordersPlus ? 2 : 1
    this.addCoins(order.coins)
    this.addStars(order.stars * starMul)
    this.addXp(order.xp)
    this.replaceOrder(index)
    return order
  }
}

export const mergeSave = new MergeSave()
