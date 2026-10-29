# Production Release Checklist

## 1. Pre-release validation

Run from the repository root:

```bash
npm ci
npm run typecheck
npm run build
npm run test:server-security
npm run test:server-hardening
npm run test:multiplayer
npm run test:browser:mobile
```

For a release candidate, also run the browser multiplayer and performance suites when the environment supports Playwright:

```bash
npm run test:browser:multiplayer
npm run test:browser:perf
npm run test:multiplayer:perf
```

## 2. Production configuration

Copy `deploy/.env.production.example` to the deployment environment and configure:

- `WS_ALLOWED_ORIGINS` with the exact HTTPS browser origin(s).
- Connection, handshake, message-rate and session-grace limits appropriate for the deployment size.
- `NODE_ENV=production`.
- `PORT=8787` unless the hosting platform requires another internal port.

Do not commit production secrets or environment files.

## 3. Container validation

Build and run the production image:

```bash
docker build --pull -t the-last-diya:local .
docker run --rm -p 8787:8787 \
  -e NODE_ENV=production \
  -e WS_ALLOWED_ORIGINS=https://game.example.com \
  the-last-diya:local
```

Verify:

```text
GET /health -> HTTP 200
```

The GitHub Actions `Production Release` workflow performs the same container smoke test automatically.

## 4. Release process

Use semantic version tags:

```bash
git tag v1.0.0
git push origin v1.0.0
```

A `v*.*.*` tag runs the production validation pipeline and publishes the verified container image to GitHub Container Registry with provenance and SBOM metadata.

## 5. Deployment topology

Recommended production topology:

```text
Browser
  |
  +--> HTTPS --> CDN/static host --> WebGL client
  |
  +--> WSS --> TLS reverse proxy --> Node game server :8787
                                  |
                                  +--> /health
```

The browser client and WebSocket server are intentionally deployable as separate services.

## 6. Post-deployment smoke test

After deployment:

1. Open the production game in two separate browser sessions.
2. Confirm both players can join the same room.
3. Move both players and verify remote movement synchronization.
4. Light the first diya and confirm Light Level updates for both players.
5. Pick up a quest item and confirm inventory/quest state.
6. Refresh one client and confirm session restoration.
7. Complete the final event and confirm the celebration state is synchronized.
8. Confirm `/health` remains HTTP 200.
9. Check server logs for unexpected disconnects, invalid-message spikes, rate-limit events or memory growth.

## 7. Rollback

If a release is unhealthy:

1. Stop routing traffic to the new deployment.
2. Roll back to the previous known-good image/tag.
3. Re-run the two-browser smoke test.
4. Record the failed release tag and observed failure mode.
5. Fix forward only after the failure is reproducible and covered by a regression test.

## 8. Public playtest gate

Do not announce a public playtest until all of the following are true:

- Production environment variables are configured.
- HTTPS/WSS are active.
- Health checks are green.
- Security and hardening suites pass.
- Multiplayer browser regression passes.
- Mobile browser regression passes.
- Real Android and iOS testing has been completed.
- The complete player journey has been tested from first join through final celebration.
- Monitoring and rollback access are available to the operator.
