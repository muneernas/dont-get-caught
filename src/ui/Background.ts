import Phaser from 'phaser'
import { GAME } from '../config/theme'

export function drawVerticalGradient(
  scene: Phaser.Scene,
  top: number,
  bottom: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics()
  const steps = 24
  for (let i = 0; i < steps; i++) {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.IntegerToColor(top),
      Phaser.Display.Color.IntegerToColor(bottom),
      steps - 1,
      i,
    )
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1)
    g.fillRect(0, (GAME.height / steps) * i, GAME.width, GAME.height / steps + 1)
  }
  return g
}

export function addFloatingOrbs(scene: Phaser.Scene, color: number, count = 8): void {
  for (let i = 0; i < count; i++) {
    const orb = scene.add.circle(
      Phaser.Math.Between(20, GAME.width - 20),
      Phaser.Math.Between(40, GAME.height - 40),
      Phaser.Math.Between(10, 28),
      color,
      Phaser.Math.FloatBetween(0.04, 0.12),
    )
    scene.tweens.add({
      targets: orb,
      y: orb.y + Phaser.Math.Between(-40, 40),
      x: orb.x + Phaser.Math.Between(-20, 20),
      duration: Phaser.Math.Between(2800, 5200),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: i * 120,
    })
  }
}
