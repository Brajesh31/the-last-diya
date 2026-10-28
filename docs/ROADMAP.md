# The Last Diya Roadmap

## Phase 0 · Pre-production | Complete
- [x] Game Design Document
- [x] Architecture
- [x] Networking contract
- [x] MVP scope
- [x] Asset and cultural direction

## Phase 1 · Technical Prototype | Complete
- [x] npm workspace monorepo
- [x] React + Vite web shell
- [x] Three.js game client
- [x] Node.js + WebSocket server foundation
- [x] Shared TypeScript contracts
- [x] Basic neighbourhood blockout
- [x] Third-person prototype camera
- [x] WASD / arrow movement
- [x] First diya interaction
- [x] Local Light Level progression
- [x] Game client connected to authoritative server
- [x] Room join and player spawn synchronization
- [x] Player movement synchronization
- [x] Server-authoritative diya interaction
- [x] Server-side interaction distance validation
- [x] Shared Light Level synchronization

## Phase 2 · Core Gameplay | In progress
- [x] Inventory primitives and item definitions
- [x] Starting player inventory
- [x] Server inventory state and synchronization
- [x] Inventory UI
- [x] NPC definitions and dialogue data
- [x] NPC interaction system
- [x] Dialogue UI
- [x] Quest definitions and state model
- [x] Server quest state and synchronization
- [x] Quest UI
- [x] First quest completion through diya interaction
- [x] Item pickup interactions
- [x] Server-authoritative item collection
- [x] Pickup rewards into inventory
- [x] Quest prerequisite enforcement and reward pipeline
- [x] Flame sharing between nearby players
- [x] Shared world progression state
- [x] Final Dark District interaction
- [x] Personal quest progression remains available after shared world objectives are completed
- [x] Quest pickups are scoped per player and restored in their room snapshot
- [ ] Extended quest content beyond the five-quest vertical slice

## Phase 3 · Multiplayer Prototype | In progress
- [x] Room lifecycle
- [x] Player spawn/despawn
- [x] Movement synchronization
- [x] Interaction synchronization
- [x] Room snapshot/state recovery
- [x] Server interaction validation
- [x] Server rate limiting
- [x] WebSocket heartbeat and timeout handling
- [x] Client reconnect loop
- [x] Personal player-state restoration across reconnects
- [x] Automated multiplayer smoke-test script
- [x] 2 / 5 / 10 / 20 / 30-player load-test script with unique spawn-position validation
- [x] GitHub Actions workflows for multiplayer smoke and load tests
- [x] Multiplayer smoke workflow passes for shared world state and per-player quest progress
- [x] Multiplayer load-test workflow passes at 2, 5 and 10 players
- [x] Validate 20 / 30-player sessions through simulated server/WebSocket load tests

## Phase 4 · Vertical Slice | In progress
- [x] One compact neighbourhood blockout
- [x] Five NPCs and five-quest progression chain
- [x] One memory sequence
- [x] Market and temple-area storytelling prototypes
- [x] Final community celebration prototype
- [x] Dynamic neighbourhood transformation driven by shared Light Level
- [x] Ambient audio prototype
- [x] Environmental storytelling prototype
- [x] Atmosphere and ember particle prototype
- [x] Procedural doors, windows, benches, stalls and street lamps
- [x] Role-specific procedural NPC characters
- [x] NPC idle animations, contextual activity zones and Light-Level dialogue
- [x] Procedural third-person player avatar
- [x] Local and remote avatar animation
- [x] Carried diya glow responds to Light Level
- [x] Orientation-aware, frame-rate-independent third-person camera follow
- [x] Shared Light Level progress meter and neighbourhood stage label in the HUD
- [x] Persistent main diya state restored from room snapshots
- [x] Main diya activation broadcast to all players in a room
- [x] Player collision against major benches, market stalls and temple-area props
- [x] Axis-separated movement allows sliding around blocked props
- [x] Interaction hotspots remain reachable around market stalls and temple platform
- [ ] Replace prototype geometry with authored, final-quality character and environment assets
- [x] Two-client Chromium E2E verifies shared diya, personal quests and pickup rewards
- [ ] Playtest full five-quest progression manually with two browser clients

## Phase 5 · Production Content
- [ ] Full quest set and additional memories
- [ ] Production-ready dialogue and narrative sequences
- [ ] Final character models, rigging and animations
- [ ] Final environment art, materials and lighting
- [ ] Production audio mix and positional sound design
- [ ] Additional community-driven world events

## Phase 6 · Hardening
- [x] Workspace type-check and build workflow added
- [x] Workspace type-check and production build pass in GitHub Actions
- [x] Expanded multiplayer smoke test verifies main diya target-state synchronization
- [x] Expanded multiplayer smoke test verifies both players can progress their personal quest chain
- [x] Load tests verify remote movement synchronization at 2 / 5 / 10 / 20 / 30 players
- [x] Load tests verify reconnect restores player session, quest progress, inventory, personal pickups and shared world state
- [x] Automated player collision test passes
- [x] Automated five-quest vertical slice test passes
- [x] Green multiplayer load tests (2 / 5 / 10 / 20 / 30-player workflow passes in GitHub Actions)
- [x] 30-player room accepts all 30 unique spawns and rejects the 31st player with ROOM_FULL
- [x] Server rejects implausibly fast movement and out-of-bounds coordinates
- [x] Room isolation tests verify player snapshots and shared diya state stay within each room
- [x] Server movement speed/bounds validation and room isolation tests pass
- [x] Server rejects movement through benches, market stalls and the temple platform
- [x] Automated 30-client movement broadcast latency benchmark with server CPU, memory and event-loop telemetry
- [x] Initial CI profile recorded: 30 clients, 12 ticks, 10,440 / 10,440 peer deliveries, p50 4.03 ms, p95 10.71 ms, p99 12.86 ms, maximum 16.07 ms
- [x] Browser rendering benchmark with multiple remote avatars and foreground-tab frame-time reporting
- [x] Crowd-aware remote avatar LOD for rooms with 8+ players, with shadow-free simplified avatars
- [ ] Crowd mode disables the dynamic shadow map and restores it when the room becomes sparse
- [x] Single-window rendering profile with 29 remote avatars using 29 WebSocket peers (one WebGL renderer)
- [x] Crowd LOD test passed 500 draw-call guard: 496 calls and 29,028 triangles versus full-detail baseline of 813 calls and 67,004 triangles
- [x] Initial six-client software-rendered CI sample recorded: five remote avatars per client, median average FPS 4.50, minimum 3.16 FPS, median p95 frame interval 400.1 ms, median JS heap 16.3 MB
- [ ] Performance profiling
- [x] WebSocket payload limits, runtime message-shape validation and expired-room state cleanup
- [ ] Separate controlled A/B test for the effect of shadow-pass reduction
- [ ] Server and networking security validation
- [ ] Monitoring and error reporting
- [ ] Analytics and playtest feedback loop

## Phase 7 · Mobile Browser
- [ ] Touch controls
- [ ] Low-quality rendering mode
- [ ] Mobile performance pass
- [ ] Device testing

## Phase 8 · Production Launch
- [ ] Staging environment
- [ ] Production load testing
- [ ] Deployment automation
- [ ] Backups
- [ ] Incident procedures
- [ ] Public launch

### First real-game milestone
Two browser windows join the same world. One player lights a diya, the other sees the change, and the shared Light Level updates. The street brightens, NPCs react, players can share flame and collect quest items, the Dark District unlocks at 90%, and both players can reach the final event.

### Validation note
The character and environment systems are implemented as procedural prototypes. Workspace type-check/build, two-player cooperative smoke tests, collision tests, the five-quest chain, two-client Chromium checks for shared diya/personal quest rewards, server movement speed/bounds/prop-collision validation, room isolation, WebSocket payload/runtime-message validation, expired-room-state cleanup, and 2 / 5 / 10-player load tests pass in GitHub Actions. Load tests also cover reconnect recovery for quest progress, inventory, personal pickups and shared world state. The 2 / 5 / 10 / 20 / 30-player server load tests pass in GitHub Actions, and the room rejects a 31st player at capacity. An opt-in 30-client concurrent movement benchmark records broadcast-latency percentiles and server CPU, memory and event-loop-delay telemetry. The first CI sample reported 10.71 ms p95 and 12.86 ms p99 broadcast latency, 16.07 ms maximum observed latency, 93.1 MB peak sampled RSS, and 16.84 ms maximum sampled event-loop delay. Treat these as a baseline from one GitHub-hosted runner, not a production SLO. These are simulated WebSocket/server tests, not a 30-browser rendering benchmark. A six-client Chromium rendering profile with five remote avatars per client passed its harness checks, but averaged 4.50 FPS (3.16 FPS minimum) under the GitHub-hosted software renderer. A single-window profile with one WebGL canvas and 29 simulated WebSocket peers passed with 29 remote avatars; crowd LOD reduced measured render work from 813 draw calls / 67,004 triangles to 496 draw calls / 29,028 triangles. The single-window sample averaged 4.82 FPS, but its p95 frame interval was 1,199.9 ms, showing severe outliers under the CI software renderer. These are CI baselines, not real-device FPS claims. Real-GPU/mobile profiling and overall performance profiling remain open. A manual visual playtest through the full five-quest chain in separate interactive browser windows and final-art replacement remain outstanding.
