# UI foundation — phase 1

## Scope
Replace HTML-string injection and delegated DOM control code with React/TypeScript components. Add an accessible Explore / Customize / Photo navigation without replacing the proven WebGL engine or model.

- Explore: existing orbit, exploded view, headlights, doors and cabin controls.
- Customize: the existing three paint finishes plus explicit Reset Finish. Selections survive workspace switches, cabin visits and replay within the current session.
- Photo: composition/orbit, Reset Camera, Clean View, and a visible/keyboard-operable way back. This is the framing foundation, not image export.
- Watch Assembly and Explore Now are separate entry paths.
- All panels stay mounted (but inactive panels are hidden). The same canvas and model instance persist across mode changes.

Full configurator options, hotspots, image export, saved builds and sharing remain later phases. There are no dead download/save buttons or claims that those features already exist.

## Architecture
`Experience.tsx` composes `AssemblyStory`, `ModeNavigation`, `CabinControls`, `CreditsDialog`, and memoized `Editorial` content. All visible text and control attributes come from React props. No `dangerouslySetInnerHTML`, runtime HTML replacement, or root click delegation remains.

`useShowroom` creates a per-instance external store, subscribes with `useSyncExternalStore`, and owns runtime initialization/cleanup. Immutable cached snapshots notify React only when a UI-visible value changes. Camera coordinates, geometry transforms and continuous scroll values remain outside React state; the runtime writes continuous CSS variables for the intro and progress bar.

`showroom/contracts.ts` defines the command/callback boundary around the existing JavaScript renderer. This phase types the UI and its adapter, not every legacy Three.js class. `runtime.ts` handles GSAP/native scrolling, model loading, focus, viewport locking and cleanup. The engine still owns 3D materials, camera motion, doors and lighting.

A narrow synchronous store commit is used when cabin/clean-view layout must be updated before measuring scroll restoration. Otherwise React controls the UI normally. Generation guards reject stale model callbacks after retry or teardown.

## Validation
`npm test`: existing animation/asset/cabin regression tests plus typed state and architecture checks.
`npm run build`: production compilation and TypeScript, existing WebGL acceptance, phase-one UI checks and the cabin suite.
`npm run build:vercel`: unit/geometry checks and production packaging, with browser verification retained in GitHub CI.

The existing paint test now opens the Customize tab before clicking paint controls; its underlying assertions are unchanged. New checks cover tabs/keyboard focus, hidden panels, matching React/renderer state, a stable canvas, clean-view recovery, mode conflicts, responsive layouts and finish persistence. Browser screenshots and diagnostics are saved in the CI artifact. Physical-device FPS, Safari and image-export functionality are not implied by these tests.

## Screenshot-review corrections
The first full browser pass succeeded, but screenshot review exposed a mobile stacking issue: the chapter rail could intercept taps on the Photo tab. The workspace now sits above the rail, and each viewport/mode is checked for real pointer hit-testing and actual state/ARIA activation, not only its bounding box. The final exterior scene reserves 100 CSS pixels beneath the canvas so the workspace does not cover the front of the car; cabin/clean views retain the full viewport.

The renderer resize hook now always refreshes the camera projection, including when orbit inspection owns the camera. This prevents aspect-ratio distortion when Clean View expands the canvas or a phone rotates. Browser checks compare the actual host dimensions, camera aspect and projection matrix at every workspace/viewport. No geometry, materials or authored camera paths changed.
