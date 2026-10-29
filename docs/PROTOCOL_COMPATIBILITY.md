# Multiplayer Protocol Compatibility

## Purpose

The browser and Node WebSocket server are released independently enough that a stale browser tab can survive a server deployment without silently corrupting a session.

## Current protocol

- Client build: `0.5.0`
- Transport: WebSocket over `ws://` locally and `wss://` in production
- Wire format: JSON
- Maximum WebSocket payload: 16 KiB
- Session restoration: signed-by-randomness session token stored in browser local storage

The browser sends `clientVersion` during `hello`. The server validates that it is a bounded string before accepting the message.

## Compatibility rules

1. Additive server messages are preferred over changing existing message meanings.
2. New client fields must be optional until every supported server is upgraded.
3. Existing message `type` values must not change semantics between patch releases.
4. A breaking protocol change requires a new protocol/client major version and a coordinated server + client rollout.
5. The server must reject malformed messages safely without throwing through the WebSocket event loop.
6. Session restoration must remain backwards compatible for at least the configured session grace period.
7. Browser deployments must never assume that a client reconnects immediately after a server deployment.

## Deployment order

For a breaking protocol release:

1. Deploy the backwards-compatible server.
2. Wait for `/health` and `/ready` to report healthy.
3. Deploy the browser client.
4. Verify two-browser reconnect and session restoration.
5. Remove compatibility code only in a later release.

## Release checks

Every release candidate should run:

- `npm run typecheck`
- `npm run build`
- `npm run test:server-security`
- `npm run test:server-hardening`
- `npm run test:multiplayer`
- `npm run test:multiplayer:load`
- `npm run test:browser:multiplayer`
- `npm run test:browser:mobile`
- `npm run test:browser:perf`

## Important limitation

The session token is a reconnect mechanism, not user authentication. Production deployments that require accounts, moderation, ownership or persistent identity need a real authentication layer before public launch.
