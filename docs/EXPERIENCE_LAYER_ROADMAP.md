# Experience Layer Roadmap

The Last Diya is now moving from vertical-slice functionality toward a polished multiplayer browser-game experience.

## Next production layer

- Remote-player interpolation and avatar LOD
- Network latency/ping visibility
- Reconnect and session-restoration recovery UX
- Contextual interaction feedback
- Final-event celebration and completion UX
- Keyboard, touch, focus, and reduced-motion accessibility consistency
- Two-player end-to-end journey regression coverage
- Renderer and scene resource disposal audits

## Current baseline

The runtime repair gate has restored the complete animation/render loop, keyboard input state, deterministic browser E2E bridge, remote-player interpolation, and resize handling. The repair is independently typechecked and built by the repair workflow before it is considered complete.

## Release rule

New experience work should remain additive and idempotent, preserve the server-authoritative model, and pass typecheck/build plus protocol, multiplayer, mobile, and browser regressions before production release.
