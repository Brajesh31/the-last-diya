# Production Performance Checklist

## Mobile

- Touch devices default to low graphics quality.
- Pixel ratio is capped to reduce GPU fill-rate pressure.
- Shadow mapping is disabled in low-quality mode.
- Atmospheric particles are disabled in low-quality mode.
- Remote player visuals use a low-detail LOD when player count increases.
- The graphics toggle lets capable mobile devices opt into high quality.
- The PWA viewport uses `viewport-fit=cover` for safe-area support.
- Landscape orientation is declared for the game shell.

## Rendering

- sRGB output and ACES filmic tone mapping are enabled.
- Soft shadows are used with bounded shadow-map sizes.
- Environment materials avoid unnecessarily reflective surfaces.
- Per-frame temporary vectors are reused in the main update loop.
- Remote-player interpolation uses squared distance checks where a square root is unnecessary.

## Release gates

Run these before a public playtest:

```text
npm run typecheck
npm run build
npm run test:browser:mobile
npm run test:browser:perf
npm run test:multiplayer:perf
```

Real-device testing is still required for Android and iOS because browser emulation cannot validate thermal behavior, sustained frame time, memory pressure, touch ergonomics, or device-specific WebGL limits.
