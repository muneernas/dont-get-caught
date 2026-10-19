import {
  BOARD_COLS,
  BOARD_ROWS,
  ITEM_BY_ID,
  mergeResult,
  type ItemDef,
} from '../../data/merge/items'

export interface CellItem {
  uid: string
  itemId: string
}

let uidSeq = 1
function nextUid(): string {
  uidSeq += 1
  return `it_${uidSeq}_${Math.floor(Math.random() * 1e5)}`
}

/**
 * Cell unlock gates by player level (Merge-Prison expanding board).
 * -1 = always open. Higher = needs that player level.
 */
export function cellUnlockLevel(x: number, y: number): number {
  // Start with a cozy 4×4 open; expand outward as level rises.
  if (x <= 3 && y <= 3) return 1
  if (x <= 4 && y <= 3) return 2
  if (x <= 5 && y <= 3) return 3
  if (y === 4 && x <= 3) return 3
  if (y === 4 && x <= 5) return 4
  return 5
}

export class BoardModel {
  readonly cols = BOARD_COLS
  readonly rows = BOARD_ROWS
  /** row-major: index = y * cols + x */
  cells: (CellItem | null)[]

  constructor(saved?: (CellItem | null)[]) {
    this.cells =
      saved?.length === this.cols * this.rows
        ? saved.map((c) => (c ? { ...c } : null))
        : Array.from({ length: this.cols * this.rows }, () => null)
  }

  index(x: number, y: number): number {
    return y * this.cols + x
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows
  }

  isUnlocked(x: number, y: number, playerLevel: number): boolean {
    if (!this.inBounds(x, y)) return false
    return playerLevel >= cellUnlockLevel(x, y)
  }

  get(x: number, y: number): CellItem | null {
    if (!this.inBounds(x, y)) return null
    return this.cells[this.index(x, y)] ?? null
  }

  set(x: number, y: number, item: CellItem | null): void {
    if (!this.inBounds(x, y)) return
    this.cells[this.index(x, y)] = item
  }

  findEmpty(playerLevel: number): { x: number; y: number } | null {
    const spots: { x: number; y: number }[] = []
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.isUnlocked(x, y, playerLevel) && !this.get(x, y)) spots.push({ x, y })
      }
    }
    if (!spots.length) return null
    return spots[Math.floor(Math.random() * spots.length)]!
  }

  spawn(
    itemId: string,
    playerLevel: number,
    at?: { x: number; y: number },
  ): { x: number; y: number; item: CellItem } | null {
    const spot = at ?? this.findEmpty(playerLevel)
    if (!spot || !this.isUnlocked(spot.x, spot.y, playerLevel) || this.get(spot.x, spot.y)) {
      return null
    }
    const item = { uid: nextUid(), itemId }
    this.set(spot.x, spot.y, item)
    return { x: spot.x, y: spot.y, item }
  }

  tryMerge(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    playerLevel: number,
  ): { x: number; y: number; item: CellItem; def: ItemDef; from: CellItem; into: CellItem } | null {
    if (fromX === toX && fromY === toY) return null
    if (!this.isUnlocked(toX, toY, playerLevel)) return null
    const a = this.get(fromX, fromY)
    const b = this.get(toX, toY)
    if (!a || !b) return null
    if (a.itemId !== b.itemId) return null
    const next = mergeResult(a.itemId)
    if (!next) return null

    const merged = { uid: nextUid(), itemId: next.id }
    this.set(fromX, fromY, null)
    this.set(toX, toY, merged)
    return { x: toX, y: toY, item: merged, def: next, from: a, into: b }
  }

  tryMove(fromX: number, fromY: number, toX: number, toY: number, playerLevel: number): boolean {
    if (!this.inBounds(toX, toY) || !this.isUnlocked(toX, toY, playerLevel)) return false
    const a = this.get(fromX, fromY)
    if (!a) return false
    if (this.get(toX, toY)) return false
    this.set(fromX, fromY, null)
    this.set(toX, toY, a)
    return true
  }

  countItem(itemId: string): number {
    return this.cells.filter((c) => c?.itemId === itemId).length
  }

  consume(itemId: string, qty: number): boolean {
    if (this.countItem(itemId) < qty) return false
    let left = qty
    for (let i = 0; i < this.cells.length && left > 0; i++) {
      if (this.cells[i]?.itemId === itemId) {
        this.cells[i] = null
        left -= 1
      }
    }
    return true
  }

  /** Consume one specific uid (selection tray → hotspot use). */
  consumeUid(uid: string): boolean {
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i]?.uid === uid) {
        this.cells[i] = null
        return true
      }
    }
    return false
  }

  defOf(cell: CellItem): ItemDef | undefined {
    return ITEM_BY_ID[cell.itemId]
  }

  serialize(): (CellItem | null)[] {
    return this.cells.map((c) => (c ? { ...c } : null))
  }
}
