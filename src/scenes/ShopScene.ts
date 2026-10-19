import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import { monetization, SHOP_PRODUCTS } from '../monetization/stubs'
import { saveSystem } from '../systems/SaveSystem'
import { audioSystem } from '../systems/AudioSystem'
import { createButton } from '../ui/Button'
import { drawVerticalGradient } from '../ui/Background'

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop')
  }

  create(): void {
    drawVerticalGradient(this, 0x1a2744, 0x0e1528)
    this.add
      .text(GAME.width / 2, 56, 'SHOP', {
        fontFamily: FONT.display,
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: '900',
      })
      .setOrigin(0.5)

    this.add
      .text(GAME.width / 2, 90, `${saveSystem.snapshot.coins} coins`, {
        fontFamily: FONT.body,
        fontSize: '14px',
        color: '#ffd166',
      })
      .setOrigin(0.5)

    createButton(this, {
      x: 48,
      y: 56,
      width: 64,
      height: 40,
      label: '←',
      fill: COLORS.bgPanel,
      fontSize: 22,
      onClick: () => this.scene.start('Menu'),
    })

    const tabs = ['Coins', 'Cosmetics', 'Boosts'] as const
    let tab: (typeof tabs)[number] = 'Coins'
    const listY = 200

    const render = () => {
      this.children.getAll().forEach((c) => {
        if ((c as Phaser.GameObjects.GameObject & { shopRow?: boolean }).shopRow) c.destroy()
      })

      const products = SHOP_PRODUCTS.filter((p) => {
        if (tab === 'Coins') return p.kind === 'coins' || p.kind === 'remove_ads'
        if (tab === 'Cosmetics') return p.kind === 'cosmetic'
        return p.kind === 'boost'
      })

      products.forEach((p, i) => {
        const y = listY + i * 92
        const g = this.add.graphics()
        g.fillStyle(COLORS.card, 1)
        g.fillRoundedRect(24, y, GAME.width - 48, 80, 16)
        ;(g as Phaser.GameObjects.Graphics & { shopRow?: boolean }).shopRow = true

        const t = this.add.text(40, y + 18, p.title, {
          fontFamily: FONT.display,
          fontSize: '16px',
          color: '#ffffff',
          fontStyle: '800',
        })
        ;(t as Phaser.GameObjects.Text & { shopRow?: boolean }).shopRow = true

        const sub = this.add.text(40, y + 44, p.priceLabel, {
          fontFamily: FONT.body,
          fontSize: '13px',
          color: '#a8b4c8',
        })
        ;(sub as Phaser.GameObjects.Text & { shopRow?: boolean }).shopRow = true

        const owned =
          (p.kind === 'cosmetic' && saveSystem.snapshot.cosmeticsOwned.includes(p.id)) ||
          (p.kind === 'remove_ads' && saveSystem.snapshot.adsRemoved)

        const btn = createButton(this, {
          x: GAME.width - 78,
          y: y + 40,
          width: 88,
          height: 36,
          label: owned ? 'OWNED' : 'GET',
          fill: owned ? COLORS.lock : COLORS.accent,
          fontSize: 14,
          onClick: async () => {
            if (owned) return
            audioSystem.play('coins')
            if (p.priceLabel.includes('coins')) {
              const cost = parseInt(p.priceLabel, 10)
              if (!saveSystem.spendCoins(cost)) return
              if (p.kind === 'cosmetic') {
                saveSystem.ownCosmetic(p.id)
                saveSystem.equipCosmetic(p.id)
              }
              if (p.kind === 'boost') saveSystem.addBoost('retryToken', p.amount ?? 1)
            } else {
              await monetization.purchase(p.id)
              if (p.kind === 'coins') saveSystem.addCoins(p.amount ?? 0)
              if (p.kind === 'remove_ads') saveSystem.setAdsRemoved()
              if (p.kind === 'cosmetic') {
                saveSystem.ownCosmetic(p.id)
                saveSystem.equipCosmetic(p.id)
              }
            }
            this.scene.restart()
          },
        })
        ;(btn as Phaser.GameObjects.Container & { shopRow?: boolean }).shopRow = true
      })
    }

    tabs.forEach((name, i) => {
      createButton(this, {
        x: 78 + i * 118,
        y: 140,
        width: 104,
        height: 40,
        label: name,
        fill: COLORS.bgPanel,
        fontSize: 14,
        onClick: () => {
          tab = name
          render()
        },
      })
    })

    this.add
      .text(GAME.width / 2, 780, 'Cosmetics are visual-only. No pay-to-win.', {
        fontFamily: FONT.body,
        fontSize: '12px',
        color: '#6b7280',
      })
      .setOrigin(0.5)

    render()
  }
}
