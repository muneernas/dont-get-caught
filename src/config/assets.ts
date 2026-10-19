/** Texture keys + mapping from NPC id → character pack. */

export type PoseKey = 'idle' | 'talk' | 'think' | 'walk0' | 'walk2' | 'hurt' | 'cheer0' | 'duck' | 'hold' | 'show'

export interface CharacterDef {
  id: string
  /** Filename prefix under /assets/characters/{prefix}_{pose}.png */
  prefix: string
  poses: PoseKey[]
  displayScale: number
}

export const PLAYER_CHAR: CharacterDef = {
  id: 'player',
  prefix: 'player',
  poses: ['idle', 'talk', 'think', 'duck', 'walk0', 'walk2', 'cheer0', 'hurt', 'hold'],
  displayScale: 0.78,
}

export const NPC_CHARS: Record<string, CharacterDef> = {
  teacher: {
    id: 'teacher',
    prefix: 'teacher',
    poses: ['idle', 'talk', 'think', 'walk0', 'walk2', 'show', 'hurt', 'cheer0'],
    displayScale: 0.74,
  },
  boss: {
    id: 'boss',
    prefix: 'boss',
    poses: ['idle', 'talk', 'think', 'walk0', 'walk2', 'show', 'hurt'],
    displayScale: 0.74,
  },
  librarian: {
    id: 'librarian',
    prefix: 'librarian',
    poses: ['idle', 'talk', 'think', 'walk0', 'walk2', 'hold', 'hurt'],
    displayScale: 0.72,
  },
  officer: {
    id: 'officer',
    prefix: 'officer',
    poses: ['idle', 'talk', 'think', 'walk0', 'walk2', 'hurt', 'show'],
    displayScale: 0.7,
  },
  auntie: {
    id: 'auntie',
    prefix: 'auntie',
    poses: ['idle', 'talk', 'think', 'walk0', 'walk2', 'show', 'cheer0'],
    displayScale: 0.7,
  },
  uncle: {
    id: 'uncle',
    prefix: 'uncle',
    poses: ['idle', 'talk', 'think', 'walk0', 'walk2', 'show', 'cheer0'],
    displayScale: 0.7,
  },
  cousin: {
    id: 'cousin',
    prefix: 'cousin',
    poses: ['idle', 'talk', 'think', 'walk0', 'walk2', 'show', 'cheer0'],
    displayScale: 0.68,
  },
}

export const LEVEL_BACKGROUNDS: Record<string, string> = {
  classroom: 'bg_classroom',
  office: 'bg_office',
  library: 'bg_library',
  airport: 'bg_airport',
  wedding: 'bg_wedding',
}

export function textureKey(prefix: string, pose: string): string {
  return `char_${prefix}_${pose}`
}

export function poseForNpcState(state: string, walking: boolean): PoseKey {
  switch (state) {
    case 'LOOKING':
      return 'think'
    case 'SUSPICIOUS':
      return 'talk'
    case 'INVESTIGATING':
      return walking ? 'walk2' : 'show'
    case 'CAUGHT':
      return 'hurt'
    case 'PATROLLING':
      return walking ? 'walk0' : 'idle'
    case 'IDLE':
    default:
      return 'idle'
  }
}
