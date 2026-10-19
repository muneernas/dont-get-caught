import Phaser from 'phaser'
import { GAME } from './config/theme'
import { BootScene } from './scenes/BootScene'
import { MenuScene } from './scenes/MenuScene'
import { LevelSelectScene } from './scenes/LevelSelectScene'
import { IntroScene } from './scenes/IntroScene'
import { GameScene } from './scenes/GameScene'
import { ResultScene } from './scenes/ResultScene'
import { ShopScene } from './scenes/ShopScene'
import { SettingsScene } from './scenes/SettingsScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME.width,
  height: GAME.height,
  backgroundColor: '#0e1528',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    BootScene,
    MenuScene,
    LevelSelectScene,
    IntroScene,
    GameScene,
    ResultScene,
    ShopScene,
    SettingsScene,
  ],
  input: {
    activePointers: 3,
  },
  render: {
    antialias: true,
    roundPixels: true,
  },
}

// eslint-disable-next-line no-new
new Phaser.Game(config)
