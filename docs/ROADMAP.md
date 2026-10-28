# The Last Diya Roadmap

## Phase 0 · Pre-production — Complete
- Game Design Document
- Architecture
- Networking contract
- MVP scope
- Asset and cultural direction

## Phase 1 · Technical Prototype — Complete
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

## Phase 2 · Core Gameplay — In progress
- [x] Inventory primitives
- [x] Item definitions
- [x] Starting player inventory
- [x] Server inventory state
- [x] Inventory synchronization contract
- [x] Inventory UI
- [x] NPC definitions and dialogue data
- [x] NPC interaction system
- [x] Dialogue UI
- [x] Quest definitions and state model
- [x] Server quest state
- [x] Quest synchronization contract
- [x] Quest UI
- [x] First quest completion through diya interaction
- [x] Item pickup interactions
- [x] Server-authoritative item collection
- [x] Pickup rewards into inventory
- [x] Flame sharing between nearby players
- [x] Shared world progression state
- [ ] Quest reward pipeline
- [ ] Final Dark District interaction

## Phase 3 · Multiplayer Prototype
- [x] Room lifecycle
- [x] Player spawn/despawn
- [x] Movement synchronization
- [x] Interaction synchronization
- [ ] Reconnect handling with state restoration
- [x] Server interaction validation
- [ ] Rate limiting
- [ ] Snapshot/state recovery

## Phase 4 · Vertical Slice
- One complete neighbourhood slice
- Five NPCs
- Five quests
- One memory sequence
- Market and temple-area storytelling
- Final event prototype

## Phase 5 · Production Content
- Full quest set
- More memories
- Audio
- Particles
- Environmental storytelling
- Dynamic events

## Phase 6 · Hardening
- 2 / 5 / 10 / 20 / 30 player tests
- Performance profiling
- Security validation
- Monitoring
- Analytics

## Phase 7 · Mobile Browser
- Touch controls
- Low-quality rendering mode
- Mobile performance pass
- Device testing

## Phase 8 · Production Launch
- Staging environment
- Load testing
- Deployment automation
- Backups
- Incident procedures
- Public launch

### First real-game milestone
Two browser windows join the same world, one player lights a diya, the other sees the change, the shared Light Level updates, the street becomes brighter, an NPC reacts, players can share flame and collect quest items, the Dark District unlocks at 90%, and both players reach the final event.
