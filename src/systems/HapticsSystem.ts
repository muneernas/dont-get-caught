import { saveSystem } from './SaveSystem'

export class HapticsSystem {
  pulse(pattern: number | number[] = 12): void {
    if (!saveSystem.snapshot.settings.haptics) return
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern)
      } catch {
        /* ignore */
      }
    }
  }

  tap(): void {
    this.pulse(8)
  }

  warn(): void {
    this.pulse([20, 40, 20])
  }

  catch(): void {
    this.pulse([40, 30, 60, 30, 80])
  }

  success(): void {
    this.pulse([15, 40, 15])
  }
}

export const hapticsSystem = new HapticsSystem()
