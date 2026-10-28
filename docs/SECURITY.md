# Server Security Deployment Checklist

## Protections implemented in the vertical slice

- WebSocket payloads are capped at 16 KiB and runtime message shapes are validated.
- Invalid message sequences, excessive per-connection message bursts, idle handshakes and excess per-IP sockets are closed.
- WebSocket browser Origins can be allowlisted with `WS_ALLOWED_ORIGINS`, as a defense against cross-site WebSocket hijacking.
- Rooms validate movement bounds, speed, collision areas, interaction distance and room-local state.
- Disconnected sessions expire after a bounded grace period and room state is cleaned when no players or resumable sessions remain.

## Required deployment configuration

Set `WS_ALLOWED_ORIGINS` to a comma-separated list of exact browser origins, for example:

```text
WS_ALLOWED_ORIGINS=https://play.example.com,https://www.play.example.com
```

In `NODE_ENV=production`, browser-origin requests are rejected if the allowlist is missing. Origin checks are not authentication: native clients can omit or spoof the header. The current random session token is a short-lived bearer credential for reconnect, not an account identity or an authorization system.

The production deployment must terminate TLS and expose the game over WSS. If the app is hosted behind a reverse proxy, configure connection limits with its network topology in mind. The current limiter keys on the TCP peer address and intentionally does not trust arbitrary `X-Forwarded-For` values.

## Still required before public launch

- Decide whether rooms are public, invite-only or tied to authenticated accounts.
- If accounts/invitations are introduced, bind reconnect tokens to an authenticated identity and rotate/revoke them safely.
- Review TLS termination, proxy headers, WebSocket origin configuration and platform-level DDoS controls.
- Add central logs, alerts, abuse metrics, retention policy and incident procedures.
- Re-run security and load tests against the deployed staging environment.
- Review privacy requirements for identifiers, telemetry and player-generated content.

The current controls reduce common connection abuse. They do not replace authentication, infrastructure-level rate limiting, production monitoring or an independent security review.
