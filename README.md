# Revuelto — Extraordinary, from nothing

A scroll-driven Next.js + Three.js + GSAP landing page. The real, free Revuelto model assembles from an empty scene; scrolling backward reverses the sequence.

## Run locally

Use Node.js 22, run `npm install`, then `npm run dev`. The predev step retrieves the credited model, preserves the source assets, and creates the optimized meshopt/WebP GLB. No paid model, API key, database, or account is needed.

`npm run build` prepares assets, runs unit, headlight/door and configuration geometry checks, compiles Next.js, then runs both complete Chromium/WebGL acceptance suites. `npm start` serves the production build. Use `CHROMIUM_PATH` to supply a local Chromium executable when the bundled Linux browser is inappropriate for your OS.

## Experience

Eight assembly chapters; camera storyboard; forward headlights and floor illumination; six body colours and seven material controls; exploded view; 360-degree inspection; keyboard controls; replay; responsive design; reduced motion; Data Saver opt-in; Auto/High/Eco rendering quality; accessible loading and fallback content.

After the reveal, use **OPEN DOORS** to lift both scissor doors or **ENTER INTERIOR** to move into the driver's seat. Drag or use arrow keys/WASD to look around. Dashboard, Left Door and Passenger presets change the viewing direction. **EXIT INTERIOR** or Escape returns to the showroom. The cabin supports portrait/landscape resizing and reduced-motion entry/exit.

## Performance

The optimized car combines compressed geometry and WebP textures without joining or simplifying the independent assembly nodes. Hashed model files use immutable caching. Responsive image variants retain the approved reference image. On-demand rendering, cached shadows, bounded pixel density and offscreen suspension reduce unnecessary GPU work. Asset byte counts are recorded in the generated optimized manifest; they are not Lighthouse or hardware frame-rate measurements.

## Deployment and testing

`master` is the Vercel production branch. Feature branches receive previews. Vercel uses `npm run build:vercel`: asset preparation, optimization, all unit/model-geometry checks and the Next.js production compile. It does not launch the headless-browser acceptance suites inside the deployment builder.

The full `npm run build` remains the GitHub Actions quality command, including both complete browser suites; CI fails if acceptance fails. Verify the quality check before merging or releasing. A READY Vercel preview alone means packaging succeeded, not that the browser tests ran there.

GitHub Actions uploads `premium-browser-review` with actual-model screenshots and JSON diagnostics, including `premium.json` and `cabin.json`. Those browser reports are CI artifacts, not guaranteed public URLs in a Vercel build. Browser testing uses Chromium/software WebGL and does not establish physical-device FPS or Safari compatibility.

## Asset scope

The interactive model is a standard Revuelto, not the custom body kit in the reference image. The support frame and assembly order are illustrative, not a factory simulation. See `THIRD_PARTY_NOTICES.md` and `docs/PREMIUM-UPGRADE.md`.

## Frontend portfolio foundation

The interface is now composed from React + TypeScript components, with typed commands and a cached per-instance UI store. After assembly, **Explore**, **Customize**, and **Photo** select separate workspaces. Explore retains doors/interior and all prior car controls. Customize contains the material configurator described below; Reset Finish and Reset Build are separate from Replay. Photo provides camera composition and Clean View, with an Escape/Show Controls return path. Material customization and hotspots are delivered in phase 2; image export, saved builds and sharing remain later phases.

See `docs/UI-FOUNDATION.md` for ownership boundaries, lifecycle decisions and verification scope.

## Phase 2: configurator and detail exploration

The **Customize** workspace now has Exterior, Wheels, Interior and Review steps with seven independent material controls. **Explore** includes projected landmarks and a detail menu for headlights, wheels/brakes, doors, cockpit and engine deck. Guided close-ups connect those details to their controls. Cabin finishes can also be adjusted from the driver’s seat.

All material selections survive mode changes and Replay within the current visit. Reset Finish and Reset Build are distinct. These are demo presentation options, not official factory order codes. Save/share, reload persistence and image export are not implemented in this phase. See `docs/CONFIGURATOR.md` for scope and validation commands.
