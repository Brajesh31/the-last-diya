# Production Security and Observability

## WebSocket security

- Configure `WS_ALLOWED_ORIGINS` with the exact production web origins.
- Keep the WebSocket payload cap at 16 KiB unless a documented protocol change requires more.
- Keep `perMessageDeflate` disabled unless compression is explicitly load-tested.
- Keep connection, handshake, message-rate, and action-rate limits enabled.
- Keep heartbeat and session-grace timeouts enabled.

## Runtime configuration

Recommended production environment variables:

```text
NODE_ENV=production
PORT=8787
WS_ALLOWED_ORIGINS=https://your-game-domain.example
MAX_CONNECTIONS_PER_IP=40
HANDSHAKE_TIMEOUT_MS=10000
MESSAGE_RATE_WINDOW_MS=10000
MAX_MESSAGES_PER_WINDOW=240
HEARTBEAT_INTERVAL_MS=15000
SESSION_GRACE_MS=60000
```

Tune limits from observed traffic rather than disabling them.

## Health checks

The HTTP server exposes a small JSON health response. Use it for container/process liveness. A deployment platform should additionally verify that the WebSocket listener can accept a connection before routing public traffic.

## Observability

Track at minimum:

- active WebSocket connections
- connections rejected by origin or connection limits
- handshake failures
- invalid protocol messages
- rate-limit rejections
- heartbeat timeouts
- restored sessions
- room occupancy
- server event-loop delay
- process restarts
- memory usage
- WebSocket close codes

Do not log session tokens, cookies, authorization headers, or complete client payloads.

## Release gates

Before a public playtest:

1. Run typecheck and production build.
2. Run server security and hardening suites.
3. Run multiplayer load tests at 2, 5, 10, 20, and 30 players.
4. Run browser multiplayer and mobile performance suites.
5. Configure `WS_ALLOWED_ORIGINS` for the deployed origin.
6. Confirm health checks and restart behavior.
7. Review server logs for unexpected protocol errors or rate limiting.
8. Perform a manual reconnect and final-event test with two browsers.
