import Phaser from 'phaser'
import { COLORS, FONT, GAME } from '../config/theme'
import { monetization, SHOP_PRODUCTS } from '../monetization/stubs'
import { mergeSave } from '../systems/merge/MergeSave'
import { audioSystem } from '../systems/AudioSystem'
import { createButton } from '../ui/Button'
import { drawVerticalGradient } from '../ui/Background'

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop')
  }

  create(): void {
    drawVerticalGradient(this, COLORS.bgNavy, COLORS.bgDeep)
    this.add
      .text(GAME.width / 2, 56, 'SHOP', {
        fontFamily: FONT.display,
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: '900',
      })
      .setOrigin(0.5)

    this.add
      .text(
        GAME.width / 2,
        92,
        `${mergeSave.data.coins}🪙 · ★${mergeSave.data.stars} · ⚡${mergeSave.data.energy}`,
        {
          fontFamily: FONT.body,
          fontSize: '14px',
          color: '#ffd166',
        },
      )
      .setOrigin(0.5)

    createButton(this, {
      x: 48,
      y: 56,
      width: 64,
      height: 40,
      label: '←',
      fill: 0xffffff,
      textColor: '#1a2744',
      fontSize: 22,
      onClick: () => this.scene.start('Menu'),
    })

    const products = [
      ...SHOP_PRODUCTS.filter((p) => p.kind === 'coins' || p.kind === 'remove_ads'),
      { id: 'energy_ad', title: 'Full Energy (Ad)', priceLabel: 'Free ad', kind: 'boost' as const, amount: 1 },
      { id: 'energy_coins', title: 'Full Energy', priceLabel: '40 coins', kind: 'boost' as const, amount: 1 },
    ]

    products.forEach((p, i) => {
      const y = 140 + i * 88
      const g = this.add.graphics()
      g.fillStyle(COLORS.card, 1)
      g.fillRoundedRect(24, y, GAME.width - 48, 76, 16)
      this.add.text(40, y + 16, p.title, {
        fontFamily: FONT.display,
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: '800',
      })
      this.add.text(40, y + 42, p.priceLabel, {
        fontFamily: FONT.body,
        fontSize: '13px',
        color: '#c4b5e0',
      })

      createButton(this, {
        x: GAME.width - 78,
        y: y + 38,
        width: 88,
        height: 36,
        label: 'GET',
        fill: COLORS.accent,
        fontSize: 14,
        onClick: async () => {
          audioSystem.play('coins')
          if (p.id === 'energy_ad') {
            const res = await monetization.showRewardedAd('shop_energy')
            if (res.watched) mergeSave.refillEnergyFull()
          } else if (p.id === 'energy_coins') {
            if (mergeSave.spendCoins(40)) mergeSave.refillEnergyFull()
          } else if (p.priceLabel.includes('coins')) {
            /* coin cosmetics skipped */
          } else {
            await monetization.purchase(p.id)
            if (p.kind === 'coins') mergeSave.addCoins(p.amount ?? 0)
            if (p.kind === 'remove_ads') {
              mergeSave.data.adsRemoved = true
              mergeSave.persist()
            }
          }
          this.scene.restart()
        },
      })
    })

    this.add
      .text(GAME.width / 2, 800, 'Convenience only — never required to merge.', {
        fontFamily: FONT.body,
        fontSize: '12px',
        color: '#6b7280',
      })
      .setOrigin(0.5)
  }
}
