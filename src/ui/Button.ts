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

export function createButton(scene: Phaser.Scene, opts: ButtonOpts): Phaser.GameObjects.Container {
  const fill = opts.fill ?? COLORS.accent
  const bg = scene.add.graphics()
  const draw = (pressed: boolean) => {
    bg.clear()
    let color = fill
    if (pressed) {
      const c = Phaser.Display.Color.IntegerToColor(fill)
      c.darken(12)
      color = c.color
    }
    bg.fillStyle(color, 1)
    bg.fillRoundedRect(-opts.width / 2, -opts.height / 2, opts.width, opts.height, 18)
    bg.lineStyle(2, 0xffffff, 0.12)
    bg.strokeRoundedRect(-opts.width / 2, -opts.height / 2, opts.width, opts.height, 18)
  }
  draw(false)

  const text = scene.add
    .text(0, 0, opts.label, {
      fontFamily: FONT.display,
      fontSize: `${opts.fontSize ?? 22}px`,
      color: opts.textColor ?? '#ffffff',
      fontStyle: '800',
    })
    .setOrigin(0.5)

  const hit = scene.add
    .rectangle(0, 0, opts.width, opts.height, 0x000000, 0.001)
    .setInteractive({ useHandCursor: true })

  const container = scene.add.container(opts.x, opts.y, [bg, text, hit])

  hit.on('pointerdown', () => {
    draw(true)
    scene.tweens.add({ targets: container, scale: 0.96, duration: 60 })
    audioSystem.play('click')
    hapticsSystem.tap()
  })
  hit.on('pointerup', () => {
    draw(false)
    scene.tweens.add({ targets: container, scale: 1, duration: 80 })
    opts.onClick()
  })
  hit.on('pointerout', () => {
    draw(false)
    container.setScale(1)
  })

  return container
}
