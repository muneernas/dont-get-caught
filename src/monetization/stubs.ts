/** Monetization interfaces only — no real ads/IAP in MVP. */

export interface RewardedAdResult {
  watched: boolean
  reason: 'completed' | 'skipped' | 'unavailable' | 'removed'
}

export interface InterstitialResult {
  shown: boolean
}

export interface IapProduct {
  id: string
  title: string
  priceLabel: string
  kind: 'coins' | 'remove_ads' | 'cosmetic' | 'boost'
  amount?: number
}

export interface MonetizationService {
  showRewardedAd(placement: string): Promise<RewardedAdResult>
  showInterstitial(placement: string): Promise<InterstitialResult>
  purchase(productId: string): Promise<{ ok: boolean; productId: string }>
  listProducts(): IapProduct[]
}

export const SHOP_PRODUCTS: IapProduct[] = [
  { id: 'coins_small', title: 'Pocket Coins', priceLabel: '$0.99', kind: 'coins', amount: 200 },
  { id: 'coins_big', title: 'Coin Vault', priceLabel: '$4.99', kind: 'coins', amount: 1400 },
  { id: 'remove_ads', title: 'Remove Ads', priceLabel: '$2.99', kind: 'remove_ads' },
]

class MockMonetization implements MonetizationService {
  async showRewardedAd(_placement: string): Promise<RewardedAdResult> {
    return { watched: true, reason: 'completed' }
  }

  async showInterstitial(_placement: string): Promise<InterstitialResult> {
    return { shown: false }
  }

  async purchase(productId: string): Promise<{ ok: boolean; productId: string }> {
    return { ok: true, productId }
  }

  listProducts(): IapProduct[] {
    return SHOP_PRODUCTS
  }
}

export const monetization: MonetizationService = new MockMonetization()
