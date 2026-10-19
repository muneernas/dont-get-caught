import Phaser from 'phaser'
import {
  NPC_CHARS,
  PLAYER_CHAR,
  poseForNpcState,
  textureKey,
  type CharacterDef,
  type PoseKey,
} from '../config/assets'
import { FONT } from '../config/theme'

export interface CharacterView {
  container: Phaser.GameObjects.Container
  sprite: Phaser.GameObjects.Image
  label: Phaser.GameObjects.Text
  stateText: Phaser.GameObjects.Text
  ring: Phaser.GameObjects.Ellipse
  def: CharacterDef
  setPose: (pose: PoseKey, flipX?: boolean) => void
  setNpcVisual: (state: string, facing: number, moving: boolean) => void
}

function makeView(
  scene: Phaser.Scene,
  def: CharacterDef,
  name: string,
  ringColor: number,
  showState: boolean,
): CharacterView {
  // Soft floor shadow — reads as a person standing, not a portrait chip
  const ring = scene.add.ellipse(0, 10, 54, 16, 0x000000, 0.28)
  const idleKey = textureKey(def.prefix, 'idle')
  const sprite = scene.add.image(0, 0, idleKey).setOrigin(0.5, 0.92)
  sprite.setScale(def.displayScale)

  const label = scene.add
    .text(0, 16, name, {
      fontFamily: FONT.body,
      fontSize: '12px',
      color: '#ffffff',
      stroke: '#0e1528',
      strokeThickness: 4,
    })
    .setOrigin(0.5, 0)

  const stateText = scene.add
    .text(0, -100, '', {
      fontFamily: FONT.body,
      fontSize: '11px',
      color: '#ffd166',
      stroke: '#0e1528',
      strokeThickness: 4,
    })
    .setOrigin(0.5)
    .setVisible(showState)

  const container = scene.add.container(0, 0, [ring, sprite, label, stateText])

  const setPose = (pose: PoseKey, flipX = false) => {
    const key = textureKey(def.prefix, pose)
    if (scene.textures.exists(key)) {
      sprite.setTexture(key)
    } else {
      const fallback = textureKey(def.prefix, 'idle')
      if (scene.textures.exists(fallback)) sprite.setTexture(fallback)
    }
    sprite.setFlipX(flipX)
  }

  const setNpcVisual = (state: string, facing: number, moving: boolean) => {
    const pose = poseForNpcState(state, moving)
    setPose(pose, Math.cos(facing) < 0)
    stateText.setText(state)
    const alert = state === 'INVESTIGATING' || state === 'SUSPICIOUS' || state === 'LOOKING'
    ring.setFillStyle(alert ? ringColor : 0x000000, alert ? 0.35 : 0.28)
    ring.setScale(alert ? 1.15 : 1)
  }

  return { container, sprite, label, stateText, ring, def, setPose, setNpcVisual }
}

export function createPlayerView(scene: Phaser.Scene): CharacterView {
  const view = makeView(scene, PLAYER_CHAR, 'YOU', 0x4cc9f0, false)
  scene.tweens.add({
    targets: view.sprite,
    y: '+=2',
    duration: 750,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  })
  return view
}

export function createNpcView(
  scene: Phaser.Scene,
  npcId: string,
  name: string,
  color: number,
): CharacterView {
  const def = NPC_CHARS[npcId] ?? {
    id: npcId,
    prefix: 'teacher',
    poses: ['idle', 'talk', 'think', 'walk0'] as PoseKey[],
    displayScale: 0.72,
  }
  return makeView(scene, def, name, color, true)
}

/** Preload all character + background textures into a Boot/Preload scene. */
export function preloadGameArt(scene: Phaser.Scene): void {
  const chars = [PLAYER_CHAR, ...Object.values(NPC_CHARS)]
  for (const def of chars) {
    for (const pose of def.poses) {
      const key = textureKey(def.prefix, pose)
      scene.load.image(key, `assets/characters/${def.prefix}_${pose}.png`)
    }
  }

  scene.load.image('bg_classroom', 'assets/backgrounds/classroom.jpg')
  scene.load.image('bg_office', 'assets/backgrounds/office.jpg')
  scene.load.image('bg_library', 'assets/backgrounds/library.jpg')
  scene.load.image('bg_airport', 'assets/backgrounds/airport.jpg')
  scene.load.image('bg_wedding', 'assets/backgrounds/wedding.jpg')
  scene.load.image('menu_hero', 'assets/ui/menu-hero.jpg')
}
