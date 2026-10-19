import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import { mergeSave } from '../systems/merge/MergeSave'
import { createButton } from '../ui/Button'
import { drawVerticalGradient } from '../ui/Background'

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings')
  }

  create(): void {
    drawVerticalGradient(this, COLORS.bgNavy, COLORS.bgDeep)
    this.add
      .text(GAME.width / 2, 70, 'SETTINGS', {
        fontFamily: FONT.display,
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: '900',
      })
      .setOrigin(0.5)

    createButton(this, {
      x: 48,
      y: 70,
      width: 64,
      height: 40,
      label: '←',
      fill: COLORS.bgPanel,
      fontSize: 22,
      onClick: () => this.scene.start('Menu'),
    })

    const s = mergeSave.data.settings
    this.makeToggle(220, 'Sound', s.sound, (v) => {
      mergeSave.data.settings.sound = v
      mergeSave.persist()
    })
    this.makeToggle(320, 'Music', s.music, (v) => {
      mergeSave.data.settings.music = v
      mergeSave.persist()
    })
    this.makeToggle(420, 'Haptics', s.haptics, (v) => {
      mergeSave.data.settings.haptics = v
      mergeSave.persist()
    })

    this.add
      .text(GAME.width / 2, 540, 'Merge Haven · offline core · local save', {
        fontFamily: FONT.body,
        fontSize: '13px',
        color: '#c4b5e0',
        align: 'center',
      })
      .setOrigin(0.5)
  }

  private makeToggle(y: number, label: string, initial: boolean, onChange: (v: boolean) => void): void {
    let value = initial
    this.add.text(48, y, label, {
      fontFamily: FONT.display,
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: '800',
    })
    createButton(this, {
      x: GAME.width - 90,
      y: y + 12,
      width: 100,
      height: 40,
      label: value ? 'ON' : 'OFF',
      fill: value ? COLORS.success : COLORS.lock,
      fontSize: 16,
      onClick: () => {
        value = !value
        onChange(value)
        this.scene.restart()
      },
    })
  }
}
