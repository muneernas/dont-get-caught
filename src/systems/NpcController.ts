import Phaser from 'phaser'
import type { LevelConfig, NpcConfig, NpcState } from '../data/levels'

export interface NpcRuntime {
  config: NpcConfig
  x: number
  y: number
  state: NpcState
  facing: number
  awareness: number
  lookTimer: number
  investigateTimer: number
  patrolIndex: number
  visionCone: number
}

export class NpcController {
  npcs: NpcRuntime[] = []
  private playerX = 195
  private playerY = 360

  init(level: LevelConfig): void {
    this.npcs = level.npcs.map((config) => ({
      config,
      x: config.homeX,
      y: config.homeY,
      state: 'PATROLLING' as NpcState,
      facing: 0,
      awareness: config.awareness * 40,
      lookTimer: Phaser.Math.Between(...config.lookIntervalMs),
      investigateTimer: 0,
      patrolIndex: 0,
      visionCone: 0.85,
    }))
  }

  setPlayer(x: number, y: number): void {
    this.playerX = x
    this.playerY = y
  }

  /** Returns total proximity pressure and whether any NPC is actively looking at player. */
  update(dtMs: number, playerActing: boolean, noise: number): { pressure: number; spotted: boolean; maxAwareness: number } {
    let pressure = 0
    let spotted = false
    let maxAwareness = 0
    const dt = dtMs / 1000

    for (const npc of this.npcs) {
      this.tickNpc(npc, dt, playerActing, noise)
      maxAwareness = Math.max(maxAwareness, npc.awareness)

      const dist = Phaser.Math.Distance.Between(npc.x, npc.y, this.playerX, this.playerY)
      const inRadius = dist < npc.config.detectionRadius
      const los = this.hasLos(npc)

      if (inRadius && los) {
        const closeness = 1 - dist / npc.config.detectionRadius
        const lookMul =
          npc.state === 'LOOKING' || npc.state === 'SUSPICIOUS' || npc.state === 'INVESTIGATING'
            ? 1.4
            : 0.55
        pressure += closeness * lookMul * (0.8 + npc.config.awareness)
        if (playerActing && (npc.state === 'LOOKING' || npc.state === 'INVESTIGATING')) {
          spotted = true
          pressure += 8 * closeness
        }
      }

      if (npc.state === 'CAUGHT') spotted = true
    }

    return { pressure, spotted, maxAwareness }
  }

  private hasLos(npc: NpcRuntime): boolean {
    const angle = Phaser.Math.Angle.Between(npc.x, npc.y, this.playerX, this.playerY)
    const diff = Math.abs(Phaser.Math.Angle.Wrap(angle - npc.facing))
    return diff < npc.visionCone
  }

  private tickNpc(npc: NpcRuntime, dt: number, playerActing: boolean, noise: number): void {
    npc.lookTimer -= dt * 1000

    const dist = Phaser.Math.Distance.Between(npc.x, npc.y, this.playerX, this.playerY)
    const inRadius = dist < npc.config.detectionRadius * 1.1
    const los = this.hasLos(npc)

    if (noise > 0.5 && inRadius) {
      npc.awareness = Math.min(100, npc.awareness + noise * 25 * dt)
    }

    if (inRadius && los && playerActing) {
      npc.awareness = Math.min(100, npc.awareness + 35 * dt)
    } else if (!playerActing) {
      npc.awareness = Math.max(0, npc.awareness - 8 * dt)
    }

    switch (npc.state) {
      case 'IDLE':
      case 'PATROLLING':
        this.patrol(npc, dt)
        if (npc.lookTimer <= 0) {
          npc.state = 'LOOKING'
          npc.lookTimer = Phaser.Math.Between(700, 1400)
          npc.facing = Phaser.Math.Angle.Between(npc.x, npc.y, this.playerX + Phaser.Math.Between(-40, 40), this.playerY)
        }
        if (npc.awareness > 55) npc.state = 'SUSPICIOUS'
        break
      case 'LOOKING':
        if (npc.lookTimer <= 0) {
          npc.state = 'PATROLLING'
          npc.lookTimer = Phaser.Math.Between(...npc.config.lookIntervalMs)
        }
        if (npc.awareness > 50 && inRadius && los) {
          npc.state = 'SUSPICIOUS'
        }
        break
      case 'SUSPICIOUS':
        npc.facing = Phaser.Math.Angle.Between(npc.x, npc.y, this.playerX, this.playerY)
        this.moveToward(npc, this.playerX, this.playerY, dt, 0.6)
        if (npc.awareness > 75) {
          npc.state = 'INVESTIGATING'
          npc.investigateTimer = 2200
        }
        if (npc.awareness < 35) npc.state = 'PATROLLING'
        break
      case 'INVESTIGATING':
        npc.investigateTimer -= dt * 1000
        this.moveToward(npc, this.playerX, this.playerY, dt, 1.1)
        npc.facing = Phaser.Math.Angle.Between(npc.x, npc.y, this.playerX, this.playerY)
        if (dist < 48 && los && (playerActing || npc.awareness > 85)) {
          npc.state = 'CAUGHT'
        }
        if (npc.investigateTimer <= 0 && npc.awareness < 70) {
          npc.state = 'PATROLLING'
        }
        break
      case 'CAUGHT':
        break
    }
  }

  private patrol(npc: NpcRuntime, dt: number): void {
    const points = npc.config.patrolPoints
    if (!points?.length) {
      npc.state = 'IDLE'
      return
    }
    const target = points[npc.patrolIndex % points.length]!
    this.moveToward(npc, target.x, target.y, dt, 1)
    npc.facing = Phaser.Math.Angle.Between(npc.x, npc.y, target.x, target.y)
    if (Phaser.Math.Distance.Between(npc.x, npc.y, target.x, target.y) < 8) {
      npc.patrolIndex += 1
    }
  }

  private moveToward(npc: NpcRuntime, x: number, y: number, dt: number, mul: number): void {
    const angle = Phaser.Math.Angle.Between(npc.x, npc.y, x, y)
    const speed = npc.config.moveSpeed * mul * dt
    npc.x += Math.cos(angle) * speed
    npc.y += Math.sin(angle) * speed
  }

  anyCaught(): boolean {
    return this.npcs.some((n) => n.state === 'CAUGHT')
  }
}
