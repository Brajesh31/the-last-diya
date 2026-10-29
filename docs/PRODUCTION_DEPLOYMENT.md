# Production Deployment

## Architecture

The browser game is a static WebGL application. The authoritative multiplayer server runs separately as a Node.js WebSocket service.

Recommended production topology:

- Static game client behind a CDN or static hosting provider.
- Node.js game server behind a TLS-enabled reverse proxy or managed container platform.
- HTTPS for the client and WSS for multiplayer traffic.
- `/health` used by the container/load balancer health check.

## Container

Build from the repository root:

```bash
docker build -t the-last-diya-server .
```

Run with the required browser origin:

```bash
docker run --rm \
  -e NODE_ENV=production \
  -e WS_ALLOWED_ORIGINS=https://your-game-domain.example \
  -p 8787:8787 \
  the-last-diya-server
```

Docker Compose is available at `deploy/docker-compose.production.yml`.

## Required production configuration

`WS_ALLOWED_ORIGINS` must contain the exact browser origin(s) allowed to open WebSocket connections. Do not leave this empty in production.

Security controls can be tuned with:

- `MAX_CONNECTIONS_PER_IP`
- `HANDSHAKE_TIMEOUT_MS`
- `MESSAGE_RATE_WINDOW_MS`
- `MAX_MESSAGES_PER_WINDOW`
- `HEARTBEAT_INTERVAL_MS`
- `SESSION_GRACE_MS`

Use `deploy/.env.production.example` as the starting point.

## Reverse proxy requirements

The proxy must:

1. Terminate TLS.
2. Preserve the WebSocket upgrade headers.
3. Route `/health` to the game server.
4. Route WebSocket traffic to the same server and keep idle connections alive.
5. Avoid buffering WebSocket traffic.

## Release gates

Before public playtesting:

```bash
npm ci
npm run typecheck
npm run build
npm run test:server-security
npm run test:server-hardening
npm run test:multiplayer
npm run test:browser:multiplayer
npm run test:browser:mobile
```

Then verify `/health`, open the game over HTTPS, and confirm multiplayer connects over WSS.

## Operational rules

Never commit production environment files, session tokens, credentials, or provider secrets. Session tokens are runtime credentials and must not appear in logs, analytics events, screenshots, or bug reports.

Use graceful termination during deploys so existing WebSocket clients can reconnect through the normal session restoration flow.
