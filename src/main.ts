import Phaser from 'phaser'
import { GAME } from './config/theme'
import { BootScene } from './scenes/BootScene'
import { MenuScene } from './scenes/MenuScene'
import { MergeScene } from './scenes/MergeScene'
import { ShopScene } from './scenes/ShopScene'
import { SettingsScene } from './scenes/SettingsScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME.width,
  height: GAME.height,
  backgroundColor: '#1a1033',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, MergeScene, ShopScene, SettingsScene],
  input: {
    activePointers: 3,
  },
  render: {
    antialias: true,
    roundPixels: true,
  },
}

const game = new Phaser.Game(config)
;(window as unknown as { __DGC_GAME__: Phaser.Game }).__DGC_GAME__ = game
