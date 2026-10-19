import type { LevelConfig } from './types'
import { classroom } from './classroom'
import { office } from './office'
import { library } from './library'
import { airport } from './airport'
import { wedding } from './wedding'

export * from './types'

export const LEVELS: LevelConfig[] = [
  classroom,
  office,
  library,
  airport,
  wedding,
].sort((a, b) => a.order - b.order)

export function getLevel(id: string): LevelConfig | undefined {
  return LEVELS.find((l) => l.id === id)
}

export function getLevelByOrder(order: number): LevelConfig | undefined {
  return LEVELS.find((l) => l.order === order)
}

export function nextLevel(id: string): LevelConfig | undefined {
  const current = getLevel(id)
  if (!current) return undefined
  return getLevelByOrder(current.order + 1)
}
