# DON'T GET CAUGHT

Casual mobile stealth MVP — complete an objective without getting noticed.

## Stack

- Vite + TypeScript + Phaser 3
- Portrait, touch-first, offline core loop
- Data-driven levels under `src/data/levels/`

## Run locally

```bash
npm install
npm run dev
```

Opens on **http://127.0.0.1:47321**

```bash
npm run build
npm run preview
```

## Core loop

Main Menu → Level Select → Intro → Gameplay → Success/Caught → Rewards → Next Level

## MVP levels

1. Classroom — copy homework  
2. Office — print personal doc  
3. Library — forbidden snack  
4. Airport — oversized bag  
5. Wedding — escape relatives  

## Project structure

```
src/
  config/         theme, constants
  data/levels/    level configs (add a level = add a file)
  systems/        save, audio, haptics, economy, suspicion, NPC
  scenes/         Boot, Menu, LevelSelect, Intro, Game, Result, Shop, Settings
  ui/             buttons, bars, backgrounds
  monetization/   ad/IAP stubs only
  utils/
```

## Notes

- Progress, coins, stars, settings persist in `localStorage`
- Shop / rewarded ads are interface stubs (no real payments)
- Designed for later Capacitor wrap (Android/iOS)
