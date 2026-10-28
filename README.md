# 🪔 The Last Diya

> A cooperative multiplayer web adventure where players carry a flame through a dark Indian city and bring it back to life.

## Status

**Phase 1 · Technical Prototype — Multiplayer slice in progress**

The repository now contains the working browser game foundation, realtime WebSocket server, shared game contracts, room joining, player movement synchronization, server-authoritative diya interaction, and shared Light Level progression.

## Stack

- React + Vite + TypeScript for the product website and launcher
- Three.js for the 3D browser game
- Node.js + TypeScript for the realtime game server
- WebSocket-based authoritative multiplayer
- PostgreSQL / Supabase planned for persistent data
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
  networking/ Multiplayer wire helpers
  database/  Persistence layer foundation
  config/    Shared configuration
assets/      Game assets and asset metadata
docs/        Product, game, technical and production specifications
scripts/     Development and maintenance scripts
```

## Current Multiplayer Slice

1. Start the realtime server on port `8787`.
2. Start the game client on port `5174`.
3. Open two browser windows.
4. Both clients join `main-street`.
5. Player movement is synchronized through the authoritative server.
6. Walk to the diya and press `E`.
7. The server validates the interaction and updates the room Light Level.
8. Both clients receive the shared world update.

The game server endpoint can be configured with `VITE_GAME_SERVER_URL` in `apps/game/.env`.

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

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the development sequence.

## License

MIT. See [`LICENSE`](LICENSE).
