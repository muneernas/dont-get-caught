import {
  ENERGY_REGEN_MS,
  GENERATORS,
  MAX_ENERGY,
  ORDER_POOL,
  XP_PER_LEVEL,
} from '../../data/merge/items'
import { BoardModel, type CellItem } from './BoardModel'

export interface ActiveOrder {
  templateId: string
  needs: { itemId: string; qty: number }[]
  coins: number
  xp: number
}

export interface MergeSaveData {
  version: number
  coins: number
  energy: number
  energyUpdatedAt: number
  xp: number
  level: number
  board: (CellItem | null)[]
  generatorReadyAt: Record<string, number>
  orders: ActiveOrder[]
  settings: { sound: boolean; haptics: boolean; music: boolean }
  dailyClaimed: string
  adsRemoved: boolean
  totalMerges: number
  totalOrders: number
}

const KEY = 'dgc_merge_v1'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function pickOrders(n: number, avoid: string[] = []): ActiveOrder[] {
  const pool = ORDER_POOL.filter((o) => !avoid.includes(o.id))
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n).map((o) => ({
    templateId: o.id,
    needs: o.needs.map((x) => ({ ...x })),
    coins: o.coins,
    xp: o.xp,
  }))
}

function defaultSave(): MergeSaveData {
  const board = new BoardModel()
  // Starter crumbs
  board.spawn('tools_1')
  board.spawn('tools_1')
  board.spawn('crops_1')
  board.spawn('crops_1')
  return {
    version: 1,
    coins: 40,
    energy: MAX_ENERGY,
    energyUpdatedAt: Date.now(),
    xp: 0,
    level: 1,
    board: board.serialize(),
    generatorReadyAt: Object.fromEntries(GENERATORS.map((g) => [g.id, 0])),
    orders: pickOrders(3),
    settings: { sound: true, haptics: true, music: true },
    dailyClaimed: '',
    adsRemoved: false,
    totalMerges: 0,
    totalOrders: 0,
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
      const raw = localStorage.getItem(KEY)
      if (!raw) return defaultSave()
      const parsed = JSON.parse(raw) as MergeSaveData
      return { ...defaultSave(), ...parsed, settings: { ...defaultSave().settings, ...parsed.settings } }
    } catch {
      return defaultSave()
    }
  }

  persist(): void {
    localStorage.setItem(KEY, JSON.stringify(this.data))
  }

  regenEnergy(): void {
    const now = Date.now()
    if (this.data.energy >= MAX_ENERGY) {
      this.data.energyUpdatedAt = now
      return
    }
    const elapsed = now - this.data.energyUpdatedAt
    const gained = Math.floor(elapsed / ENERGY_REGEN_MS)
    if (gained > 0) {
      this.data.energy = Math.min(MAX_ENERGY, this.data.energy + gained)
      this.data.energyUpdatedAt += gained * ENERGY_REGEN_MS
      this.persist()
    }
  }

  msToNextEnergy(): number {
    this.regenEnergy()
    if (this.data.energy >= MAX_ENERGY) return 0
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
    }
    this.persist()
    return leveled
  }

  refillEnergyFull(): void {
    this.data.energy = MAX_ENERGY
    this.data.energyUpdatedAt = Date.now()
    this.persist()
  }

  claimDaily(): number | null {
    if (this.data.dailyClaimed === today()) return null
    this.data.dailyClaimed = today()
    const reward = 50
    this.addCoins(reward)
    return reward
  }

  replaceOrder(index: number): void {
    const avoid = this.data.orders.map((o) => o.templateId)
    const next = pickOrders(1, avoid)[0]
    if (next) this.data.orders[index] = next
    this.persist()
  }

  completeOrder(index: number): ActiveOrder | null {
    const order = this.data.orders[index]
    if (!order) return null
    this.data.totalOrders += 1
    this.addCoins(order.coins)
    this.addXp(order.xp)
    this.replaceOrder(index)
    return order
  }
}

export const mergeSave = new MergeSave()
