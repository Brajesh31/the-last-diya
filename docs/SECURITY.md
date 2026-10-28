# The Last Diya Security Review

## Current automated controls

- WebSocket frames are capped at 16 KiB by the server.
- Client messages are decoded and checked against the runtime message contract before gameplay handling.
- Five invalid messages on one socket trigger WebSocket policy close `1008`.
- Gameplay actions are rate-limited to one accepted action per 250 ms per player.
- Player movement is checked for finite coordinates, walkable bounds, movement speed and server-side prop collisions.
- Gameplay actions are rejected until a socket has joined a room.
- Room IDs are normalized and constrained before they become room state keys.
- Room snapshots and shared world state are scoped to the player's room.
- Session restoration has an expiry window and expired room state is cleaned up.
- WebSocket heartbeat/pong handling terminates stale connections.
- Room capacity is capped at 30 players.
- Automated security regression tests cover malformed JSON, malformed message shapes, repeated invalid messages, oversized frames, unjoined gameplay actions and invalid transforms.

## Production deployment requirements

These items remain required before a public production launch:

1. Terminate WebSockets over TLS (`wss://`) behind the production edge/proxy.
2. Apply connection-rate and concurrent-connection limits at the edge, preferably keyed by authenticated account and source IP rather than relying only on the game process.
3. Configure an explicit WebSocket `Origin` allowlist at the edge/server for the production game domain.
4. Add real authentication/session binding before exposing persistent accounts or valuable progression.
5. Keep secrets and database credentials outside the client bundle and repository.
6. Add structured server logs, error reporting, alerting and dashboards for connection failures, policy closes, room saturation and abnormal message rates.
7. Define retention and privacy rules for player identifiers, telemetry and future account data.
8. Run a production-like load test through the actual TLS/proxy path before launch.
9. Add dependency and container/image scanning to the deployment pipeline.
10. Establish incident response, rollback and credential-rotation procedures.

## Security regression command

```bash
npm run test:server-security
```

The GitHub Actions workflow `.github/workflows/server-security-test.yml` runs this suite on relevant server and networking changes.

## Scope note

Passing the automated regression suite means the currently implemented server invariants are covered by repeatable tests. It is not a penetration test and does not by itself establish production security readiness.
