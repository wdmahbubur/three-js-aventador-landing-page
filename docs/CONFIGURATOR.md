# Phase 2 — Material configurator and guided details

## Visitor flow

Explore Now (or complete the assembly) → Explore a landmark → Customize → Exterior / Wheels / Interior / Review.

Six body colours, gloss/matte paint, satin/polished exterior carbon, three wheel finishes, three caliper colours, four seat-insert colours, and four cabin-accent options. These are independent presentation choices, not manufacturer configuration codes, upholstery catalogues, pricing, or changes to wheel geometry.

Select the Wheels step for a wheel close-up. Select Interior for the open driver-side doorway and use Preview from the Driver’s Seat to inspect your cabin. A collapsible Cabin Finishes control also changes seat inserts and cabin accents while seated. Exit returns to the launching workspace.

Reset Finish resets only body colour. Reset Build resets all seven settings. Replay, mode changes, door motion and interior exploration retain your complete build during the current mounted visit. Reload persistence, save/share, image export and Photo lighting presets remain later phases.

## Architecture

- `configuration.mjs`: whitelisted domain options, immutable normalization and explicit material-scope rules.
- `MaterialConfigurator`: clones only configurable shared materials and restores them on disposal. The source `Interior_color` material is split between seat inserts and cabin trim; tyre, glass, screen and logo materials are excluded.
- `configurator-renderer.mjs`: extends the tested cabin renderer, owns cancellable guided camera transitions and material application. It reuses the existing compressed model and canvas.
- `HotspotProjector`: projects actual model landmarks into a DOM overlay, follows the moving door, and hides offscreen, back-facing, occluded or overlapping targets. An ordinary button menu exposes every detail without requiring the visitor to hit a 3D marker.
- Typed UI state remains independent of viewing state. React owns labels, controls, selection and events. Continuous camera and projected-marker coordinates remain outside React state.
- Desktop uses a side workspace; portrait screens use a bounded, internally scrollable bottom workspace. Cabin and Clean View retain the full viewport.

## Verification

`npm test` checks the option whitelist, configuration independence, prototype-key rejection, material scope classification and existing regressions. `npm run verify:configuration` parses the real optimized GLB in Node and validates mapped materials, isolated cabin colours, unchanged geometry and landmark projection. Texture decoding and appearance require the separate browser suite.

`npm run build` retains all prior assembly, door/cabin and UI-mode checks, then exercises actual configured materials, projected hotspot clicks, camera views, in-cabin changes, reset/replay and portrait/landscape input targets. GitHub CI stores actual screenshots and diagnostics as artifacts. Vercel performs the same prebuild checks and Next.js packaging, not duplicate headless-browser acceptance.

No physical-device frame-rate or Safari result is implied by Chromium/software-WebGL CI.
