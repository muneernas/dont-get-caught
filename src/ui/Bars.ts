import Phaser from 'phaser'
import { COLORS, FONT } from '../config/theme'

export class ProgressBar {
  container: Phaser.GameObjects.Container
  private fill: Phaser.GameObjects.Graphics
  private label: Phaser.GameObjects.Text
  private width: number
  private height: number
  private color: number

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    title: string,
  ) {
    this.width = width
    this.height = height
    this.color = color
    const bg = scene.add.graphics()
    bg.fillStyle(0x000000, 0.35)
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 10)
    this.fill = scene.add.graphics()
    this.label = scene.add
      .text(-width / 2 + 8, -height / 2 - 16, title, {
        fontFamily: FONT.body,
        fontSize: '12px',
        color: '#a8b4c8',
      })
      .setOrigin(0, 0.5)
    const value = scene.add
      .text(width / 2 - 8, -height / 2 - 16, '0%', {
        fontFamily: FONT.body,
        fontSize: '12px',
        color: '#ffffff',
      })
      .setOrigin(1, 0.5)
    this.container = scene.add.container(x, y, [bg, this.fill, this.label, value])
    ;(this.container as Phaser.GameObjects.Container & { valueText: Phaser.GameObjects.Text }).valueText =
      value
  }

  set(ratio: number, color?: number): void {
    const r = Phaser.Math.Clamp(ratio, 0, 1)
    const c = color ?? this.color
    this.fill.clear()
    this.fill.fillStyle(c, 1)
    const w = Math.max(8, (this.width - 6) * r)
    this.fill.fillRoundedRect(-this.width / 2 + 3, -this.height / 2 + 3, w, this.height - 6, 8)
    const valueText = (
      this.container as Phaser.GameObjects.Container & { valueText: Phaser.GameObjects.Text }
    ).valueText
    valueText.setText(`${Math.round(r * 100)}%`)
  }

  setTitle(t: string): void {
    this.label.setText(t)
  }
}

export function suspicionColor(ratio: number): number {
  if (ratio >= 0.85) return COLORS.suspicionHigh
  if (ratio >= 0.55) return COLORS.warn
  if (ratio >= 0.3) return COLORS.suspicionMid
  return COLORS.suspicionLow
}
