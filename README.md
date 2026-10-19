# Merge Haven

Addictive portrait **merge-2** casual game (Merge Mansion / Travel Town vibe).  
Pivot of the old Don't Get Caught repo — new core loop.

## Stack

- Vite + TypeScript + Phaser 3
- Offline core, localStorage save
- Monetization stubs only (energy ads, coin packs)

## Run

```bash
npm install
npm run dev
```

**http://127.0.0.1:47321**

## How to play

Tap generators (spend energy) → drag matching items together to merge up chains → deliver orders for coins/XP → refill energy when empty.

## Chains

- **Tools** — Bolt → … → Workshop (7 tiers)
- **Crops** — Seed → … → Harvest (7 tiers)

## Project layout

```
src/data/merge/     item chains, generators, orders
src/systems/merge/  board model + save
src/scenes/         Boot, Menu, Merge, Shop, Settings
```
