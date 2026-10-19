import { BOARD_COLS, BOARD_ROWS, ITEM_BY_ID, mergeResult, type ItemDef } from '../../data/merge/items'

export interface CellItem {
  uid: string
  itemId: string
}

let uidSeq = 1
function nextUid(): string {
  uidSeq += 1
  return `it_${uidSeq}_${Math.floor(Math.random() * 1e5)}`
}

export class BoardModel {
  readonly cols = BOARD_COLS
  readonly rows = BOARD_ROWS
  /** row-major: index = y * cols + x */
  cells: (CellItem | null)[]

  constructor(saved?: (CellItem | null)[]) {
    this.cells = saved?.length === this.cols * this.rows
      ? saved.map((c) => (c ? { ...c } : null))
      : Array.from({ length: this.cols * this.rows }, () => null)
  }

  index(x: number, y: number): number {
    return y * this.cols + x
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows
  }

  get(x: number, y: number): CellItem | null {
    if (!this.inBounds(x, y)) return null
    return this.cells[this.index(x, y)] ?? null
  }

  set(x: number, y: number, item: CellItem | null): void {
    if (!this.inBounds(x, y)) return
    this.cells[this.index(x, y)] = item
  }

  findEmpty(): { x: number; y: number } | null {
    const spots: { x: number; y: number }[] = []
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (!this.get(x, y)) spots.push({ x, y })
      }
    }
    if (!spots.length) return null
    return spots[Math.floor(Math.random() * spots.length)]!
  }

  spawn(itemId: string, at?: { x: number; y: number }): { x: number; y: number; item: CellItem } | null {
    const spot = at ?? this.findEmpty()
    if (!spot || this.get(spot.x, spot.y)) return null
    const item = { uid: nextUid(), itemId }
    this.set(spot.x, spot.y, item)
    return { x: spot.x, y: spot.y, item }
  }

  /** Merge-2: drop source onto target. Returns new item + positions if success. */
  tryMerge(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): { x: number; y: number; item: CellItem; def: ItemDef; from: CellItem; into: CellItem } | null {
    if (fromX === toX && fromY === toY) return null
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

  /** Move item to empty cell (or swap if occupied by different — only empty for MVP). */
  tryMove(fromX: number, fromY: number, toX: number, toY: number): boolean {
    if (!this.inBounds(toX, toY)) return false
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

  /** Remove qty of itemId; returns false if not enough. */
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

  defOf(cell: CellItem): ItemDef | undefined {
    return ITEM_BY_ID[cell.itemId]
  }

  serialize(): (CellItem | null)[] {
    return this.cells.map((c) => (c ? { ...c } : null))
  }
}
