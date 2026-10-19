export interface LevelProgress {
  stars: number
  bestTimeSeconds: number
  bestScore: number
  cleared: boolean
  cleanClear: boolean
}

export interface SettingsState {
  sound: boolean
  music: boolean
  haptics: boolean
}

export interface SaveData {
  version: number
  coins: number
  streak: number
  lastPlayDate: string
  bestScore: number
  currentLevelId: string
  levels: Record<string, LevelProgress>
  cosmeticsOwned: string[]
  cosmeticEquipped: string
  boosts: Record<string, number>
  settings: SettingsState
  adsRemoved: boolean
  dailyChallengeClaimed: string
  challengeFlags: Record<string, boolean>
}

const KEY = 'dgc_save_v1'

const defaultSave = (): SaveData => ({
  version: 1,
  coins: 0,
  streak: 0,
  lastPlayDate: '',
  bestScore: 0,
  currentLevelId: 'classroom',
  levels: {},
  cosmeticsOwned: ['default'],
  cosmeticEquipped: 'default',
  boosts: { retryToken: 1 },
  settings: { sound: true, music: true, haptics: true },
  adsRemoved: false,
  dailyChallengeClaimed: '',
  challengeFlags: {},
})

export class SaveSystem {
  private data: SaveData

  constructor() {
    this.data = this.load()
    this.touchStreak()
  }

  get snapshot(): SaveData {
    return this.data
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return defaultSave()
      const parsed = JSON.parse(raw) as SaveData
      return { ...defaultSave(), ...parsed, settings: { ...defaultSave().settings, ...parsed.settings } }
    } catch {
      return defaultSave()
    }
  }

  persist(): void {
    localStorage.setItem(KEY, JSON.stringify(this.data))
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10)
  }

  private touchStreak(): void {
    const today = this.today()
    if (this.data.lastPlayDate === today) return
    if (!this.data.lastPlayDate) {
      this.data.streak = 1
    } else {
      const prev = new Date(this.data.lastPlayDate)
      const now = new Date(today)
      const diff = Math.round((now.getTime() - prev.getTime()) / 86400000)
      this.data.streak = diff === 1 ? this.data.streak + 1 : 1
    }
    this.data.lastPlayDate = today
    this.persist()
  }

  getLevelProgress(id: string): LevelProgress {
    return (
      this.data.levels[id] ?? {
        stars: 0,
        bestTimeSeconds: 0,
        bestScore: 0,
        cleared: false,
        cleanClear: false,
      }
    )
  }

  isUnlocked(_levelId: string, order: number, prevId?: string): boolean {
    if (order <= 1) return true
    if (!prevId) return false
    return this.getLevelProgress(prevId).cleared
  }

  addCoins(amount: number): void {
    this.data.coins = Math.max(0, this.data.coins + amount)
    this.persist()
  }

  spendCoins(amount: number): boolean {
    if (this.data.coins < amount) return false
    this.data.coins -= amount
    this.persist()
    return true
  }

  recordClear(opts: {
    levelId: string
    stars: number
    timeSeconds: number
    score: number
    clean: boolean
    coinsEarned: number
  }): void {
    const prev = this.getLevelProgress(opts.levelId)
    this.data.levels[opts.levelId] = {
      stars: Math.max(prev.stars, opts.stars),
      bestTimeSeconds:
        prev.bestTimeSeconds === 0
          ? opts.timeSeconds
          : Math.min(prev.bestTimeSeconds, opts.timeSeconds),
      bestScore: Math.max(prev.bestScore, opts.score),
      cleared: true,
      cleanClear: prev.cleanClear || opts.clean,
    }
    this.data.bestScore = Math.max(this.data.bestScore, opts.score)
    this.data.currentLevelId = opts.levelId
    this.addCoins(opts.coinsEarned)
  }

  updateSettings(partial: Partial<SettingsState>): void {
    this.data.settings = { ...this.data.settings, ...partial }
    this.persist()
  }

  ownCosmetic(id: string): void {
    if (!this.data.cosmeticsOwned.includes(id)) {
      this.data.cosmeticsOwned.push(id)
      this.persist()
    }
  }

  equipCosmetic(id: string): void {
    if (this.data.cosmeticsOwned.includes(id)) {
      this.data.cosmeticEquipped = id
      this.persist()
    }
  }

  claimDaily(date: string, reward: number): boolean {
    if (this.data.dailyChallengeClaimed === date) return false
    this.data.dailyChallengeClaimed = date
    this.addCoins(reward)
    return true
  }

  setAdsRemoved(): void {
    this.data.adsRemoved = true
    this.persist()
  }

  addBoost(id: string, amount = 1): void {
    this.data.boosts[id] = (this.data.boosts[id] ?? 0) + amount
    this.persist()
  }

  consumeBoost(id: string): boolean {
    const n = this.data.boosts[id] ?? 0
    if (n <= 0) return false
    this.data.boosts[id] = n - 1
    this.persist()
    return true
  }
}

export const saveSystem = new SaveSystem()
