# Production topology

The Last Diya is deployed as two cooperating services.

## Browser game

- Source: `apps/game`
- Build: Vite
- Recommended hosting: Vercel/CDN
- Production client variable: `VITE_GAME_SERVER_URL=wss://<game-server-host>`

## Multiplayer server

- Source: `apps/server`
- Runtime: Node.js 22
- Transport: WebSocket over TLS (`wss://`)
- Container: `Dockerfile`
- Internal port: `8787`
- Health endpoint: `/health`
- Readiness endpoint: `/ready`

## TLS routing

Terminate TLS at the reverse proxy and forward WebSocket upgrades to `127.0.0.1:8787`. The included `deploy/Caddyfile.example` is a minimal reference configuration.

## Required production settings

`WS_ALLOWED_ORIGINS` must contain the exact browser origin(s), including scheme, used by the game. Do not use `*`.

The server remains intentionally stateless with respect to durable user accounts. Session restoration is an in-memory grace-period mechanism for multiplayer continuity, not authentication.

## Release order

1. Build and validate the server image.
2. Deploy the WebSocket server and verify `/health`.
3. Configure TLS/WSS and `WS_ALLOWED_ORIGINS`.
4. Set `VITE_GAME_SERVER_URL` in the browser deployment.
5. Deploy the Vercel game client.
6. Run the two-browser multiplayer smoke test.
7. Only then open the public playtest.
