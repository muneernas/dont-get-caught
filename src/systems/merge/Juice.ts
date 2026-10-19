import Phaser from 'phaser'
import { FONT } from '../../config/theme'
import { audioSystem } from '../AudioSystem'
import { hapticsSystem } from '../HapticsSystem'

/** Shared juice helpers for Merge Haven interactivity. */
export class Juice {
  constructor(private scene: Phaser.Scene) {}

  press(target: Phaser.GameObjects.GameObject & { setScale?: (s: number) => unknown; scale?: number }): void {
    audioSystem.play('click')
    hapticsSystem.tap()
    this.scene.tweens.add({
      targets: target,
      scale: 0.9,
      duration: 60,
      yoyo: true,
      ease: 'Back.out',
    })
  }

  floatText(
    x: number,
    y: number,
    msg: string,
    color = '#ffd166',
    size = 18,
  ): void {
    const t = this.scene.add
      .text(x, y, msg, {
        fontFamily: FONT.display,
        fontSize: `${size}px`,
        color,
        fontStyle: '900',
        stroke: '#0f1a28',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(80)
    this.scene.tweens.add({
      targets: t,
      y: y - 48,
      alpha: 0,
      scale: 1.15,
      duration: 850,
      ease: 'Cubic.out',
      onComplete: () => t.destroy(),
    })
  }

  burst(x: number, y: number, color: number, count = 18): void {
    for (let i = 0; i < count; i++) {
      const p = this.scene.add
        .circle(x, y, Phaser.Math.Between(3, 7), color, 1)
        .setDepth(70)
      const ang = (Math.PI * 2 * i) / count
      const dist = Phaser.Math.Between(30, 70)
      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(ang) * dist,
        y: y + Math.sin(ang) * dist,
        alpha: 0,
        scale: 0.1,
        duration: 420,
        ease: 'Cubic.out',
        onComplete: () => p.destroy(),
      })
    }
  }

  starsBurst(x: number, y: number): void {
    audioSystem.play('coins')
    hapticsSystem.success()
    this.burst(x, y, 0xffd166, 20)
    this.burst(x, y, 0xffffff, 10)
    this.floatText(x, y - 10, '★ CLAIM!', '#ffd166', 20)
  }

  mergePop(x: number, y: number, color: number, streak: number): void {
    audioSystem.play('success')
    hapticsSystem.success()
    this.scene.cameras.main.shake(55, 0.004)
    this.scene.cameras.main.zoomTo(1.04, 80, 'Sine.out', false, (_cam, progress) => {
      if (progress === 1) this.scene.cameras.main.zoomTo(1, 120, 'Sine.in')
    })
    this.burst(x, y, color, 16)
    this.burst(x, y, 0xffffff, 8)
    const label = streak >= 2 ? `COMBO x${streak}!` : 'MERGE!'
    this.floatText(x, y - 24, label, streak >= 2 ? '#ff7a18' : '#ffd166', streak >= 2 ? 22 : 18)
  }

  flyTo(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    texture: string | null,
    tint = 0xffd166,
    onArrive?: () => void,
  ): void {
    let flyer: Phaser.GameObjects.GameObject & { x: number; y: number; setScale: (n: number) => unknown; setDepth: (n: number) => unknown; destroy: () => void; setAlpha?: (n: number) => unknown }
    if (texture && this.scene.textures.exists(texture)) {
      const img = this.scene.add.image(fromX, fromY, texture)
      img.setDisplaySize(36, 36)
      flyer = img
    } else {
      flyer = this.scene.add.circle(fromX, fromY, 14, tint, 1)
    }
    flyer.setDepth(90)
    flyer.setScale(1.2)
    this.scene.tweens.add({
      targets: flyer,
      x: toX,
      y: toY,
      scale: 0.4,
      duration: 380,
      ease: 'Cubic.in',
      onComplete: () => {
        flyer.destroy()
        this.burst(toX, toY, tint, 12)
        onArrive?.()
      },
    })
  }

  spawnArc(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    texture: string,
    onArrive?: () => void,
  ): void {
    const img = this.scene.add.image(fromX, fromY, texture)
    img.setDisplaySize(34, 34).setDepth(85).setScale(0.2)
    this.scene.tweens.add({
      targets: img,
      x: toX,
      y: toY,
      scale: 1,
      duration: 420,
      ease: 'Back.out',
      onComplete: () => {
        img.destroy()
        onArrive?.()
      },
    })
    // Arc mid boost
    this.scene.tweens.add({
      targets: img,
      y: Math.min(fromY, toY) - 40,
      duration: 210,
      yoyo: true,
      ease: 'Sine.out',
    })
  }

  idleFloat(target: Phaser.GameObjects.GameObject, baseY: number, delay = 0): void {
    this.scene.tweens.add({
      targets: target,
      y: baseY - 3,
      duration: 900 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      delay,
      ease: 'Sine.inOut',
    })
  }

  shineSweep(container: Phaser.GameObjects.Container, w = 40, h = 40): void {
    const shine = this.scene.add.rectangle(-w, 0, 10, h + 8, 0xffffff, 0.35)
    shine.setAngle(20)
    container.add(shine)
    this.scene.tweens.add({
      targets: shine,
      x: w + 8,
      duration: 700,
      delay: 600 + Math.random() * 2000,
      repeat: -1,
      repeatDelay: 2400 + Math.random() * 2000,
      onRepeat: () => {
        shine.x = -w
      },
    })
  }

  portraitTalk(portrait: Phaser.GameObjects.Image | Phaser.GameObjects.Container): void {
    this.scene.tweens.add({
      targets: portrait,
      scaleY: 1.06,
      scaleX: 0.97,
      duration: 90,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.inOut',
    })
  }

  portraitBlink(eyeCover: Phaser.GameObjects.GameObject & { setScale: (x: number, y?: number) => unknown }): void {
    const blink = () => {
      this.scene.tweens.add({
        targets: eyeCover,
        scaleY: 0.15,
        duration: 70,
        yoyo: true,
        hold: 40,
        onComplete: () => {
          this.scene.time.delayedCall(2200 + Math.random() * 2500, blink)
        },
      })
    }
    this.scene.time.delayedCall(1000 + Math.random() * 1500, blink)
  }
}
