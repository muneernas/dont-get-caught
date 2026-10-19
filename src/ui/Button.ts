import Phaser from 'phaser'
import { COLORS, FONT } from '../config/theme'
import { audioSystem } from '../systems/AudioSystem'
import { hapticsSystem } from '../systems/HapticsSystem'

export interface ButtonOpts {
  x: number
  y: number
  width: number
  height: number
  label: string
  fill?: number
  textColor?: string
  fontSize?: number
  onClick: () => void
}

/** Soft modern CTA with press scale + particle spark. */
export function createButton(scene: Phaser.Scene, opts: ButtonOpts): Phaser.GameObjects.Container {
  const fill = opts.fill ?? COLORS.accent
  const r = Math.min(22, opts.height / 2)
  const bg = scene.add.graphics()
  const draw = (pressed: boolean) => {
    bg.clear()
    const c = Phaser.Display.Color.IntegerToColor(fill)
    if (pressed) c.darken(10)
    // soft shadow
    bg.fillStyle(0x000000, 0.18)
    bg.fillRoundedRect(-opts.width / 2 + 2, -opts.height / 2 + 3, opts.width, opts.height, r)
    bg.fillStyle(c.color, 1)
    bg.fillRoundedRect(-opts.width / 2, -opts.height / 2, opts.width, opts.height, r)
    // top highlight
    bg.fillStyle(0xffffff, 0.18)
    bg.fillRoundedRect(-opts.width / 2 + 3, -opts.height / 2 + 2, opts.width - 6, opts.height * 0.38, r * 0.7)
    bg.lineStyle(2, 0xffffff, 0.22)
    bg.strokeRoundedRect(-opts.width / 2, -opts.height / 2, opts.width, opts.height, r)
  }
  draw(false)

  const text = scene.add
    .text(0, 0, opts.label, {
      fontFamily: FONT.display,
      fontSize: `${opts.fontSize ?? 22}px`,
      color: opts.textColor ?? '#ffffff',
      fontStyle: '800',
      stroke: '#0f1a28',
      strokeThickness: 2,
    })
    .setOrigin(0.5)

  const hit = scene.add
    .rectangle(0, 0, opts.width, opts.height, 0x000000, 0.001)
    .setInteractive({ useHandCursor: true })

  const container = scene.add.container(opts.x, opts.y, [bg, text, hit])

  hit.on('pointerdown', () => {
    draw(true)
    scene.tweens.add({ targets: container, scale: 0.93, duration: 55, ease: 'Back.out' })
    audioSystem.play('click')
    hapticsSystem.tap()
    for (let i = 0; i < 4; i++) {
      const spark = scene.add.circle(
        opts.x + Phaser.Math.Between(-opts.width / 3, opts.width / 3),
        opts.y,
        3,
        0xffffff,
        0.9,
      )
      scene.tweens.add({
        targets: spark,
        y: opts.y - 18,
        alpha: 0,
        duration: 280,
        onComplete: () => spark.destroy(),
      })
    }
  })
  hit.on('pointerup', () => {
    draw(false)
    scene.tweens.add({ targets: container, scale: 1, duration: 90, ease: 'Back.out' })
    opts.onClick()
  })
  hit.on('pointerout', () => {
    draw(false)
    container.setScale(1)
  })

  return container
}
