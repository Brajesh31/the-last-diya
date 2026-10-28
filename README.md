# 🪔 The Last Diya

> A cooperative multiplayer web adventure where players carry a flame through a dark Indian city and bring it back to life.

## Status

**Phase 0 · Pre-production**

This repository is the production foundation for The Last Diya. The project is being built web-first with a 3D browser game, a separate realtime server, and a supporting product website.

## Planned Stack

- React + Vite + TypeScript for the web application
- Three.js for the 3D game client
- Node.js + TypeScript for the realtime game server
- WebSocket-based authoritative multiplayer
- PostgreSQL / Supabase for persistent data
- npm workspaces
- Figma for UI/UX
- Blender for 3D assets

## Repository Structure

```text
apps/
  web/       Product website and game shell
  game/      Three.js browser game
  server/    Realtime multiplayer server
packages/
  shared/    Shared types and contracts
  game-core/ Platform-independent game rules
  networking/ Multiplayer contracts and client helpers
  database/  Persistence layer
  config/    Shared TypeScript/build configuration
assets/      Game assets and asset metadata
docs/        Product, game, technical and production specifications
scripts/     Development and maintenance scripts
```

## Development Principles

1. Build the vertical slice before expanding content.
2. Keep the game client and realtime server separate.
3. Treat the server as authoritative for multiplayer state and rewards.
4. Keep React responsible for product/UI surfaces and Three.js responsible for the 3D world.
5. Optimize for browser performance from the beginning.
6. Use licensed or original assets only.
7. Do not add large features until the core loop is fun and stable.

## Core Loop

`Explore → Help → Collect → Restore → Light → Collaborate → Unlock → Discover → Celebrate`

## MVP

- One compact Indian neighbourhood
- Third-person browser movement
- Diya/flame mechanic
- Shared Light Level
- NPCs and dialogue
- Inventory
- Quests
- Memory discoveries
- Cooperative multiplayer
- 10-player initial room target
- One final celebration event
- Desktop browser first

Mobile browser, Android packaging, larger rooms, voice chat and expanded content are post-MVP work.

## Documentation

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the development sequence and [`docs/GDD.md`](docs/GDD.md) for the game design foundation.

## License

MIT. See [`LICENSE`](LICENSE).
