# Revuelto — Extraordinary, from nothing

A scroll-driven Next.js + Three.js + GSAP landing page. The real, free Revuelto model assembles from an empty scene; scrolling backward reverses the sequence.

## Run locally

Use Node.js 22, run `npm install`, then `npm run dev`. The predev step retrieves the credited model, preserves the source assets, and creates the optimized meshopt/WebP GLB. No paid model, API key, database, or account is needed.

`npm run build` prepares assets, runs the unit and headlight geometry checks, compiles Next.js, then runs Chromium/WebGL acceptance tests. `npm start` serves the production build. Use `CHROMIUM_PATH` to supply a local Chromium executable when the bundled Linux browser is inappropriate for your OS.

## Experience

Eight assembly chapters; camera storyboard; forward headlights and floor illumination; three finishes; exploded view; 360-degree inspection; keyboard controls; replay; responsive design; reduced motion; Data Saver opt-in; Auto/High/Eco rendering quality; accessible loading and fallback content.

## Performance

The optimized car combines compressed geometry and WebP textures without joining or simplifying the independent assembly nodes. Hashed model files use immutable caching. Responsive image variants retain the approved reference image. On-demand rendering, cached shadows, bounded pixel density and offscreen suspension reduce unnecessary GPU work. Asset byte counts are recorded in the generated optimized manifest; they are not Lighthouse or hardware frame-rate measurements.

## Deployment and testing

`master` is the Vercel production branch. Feature branches receive previews. Preview builds expose failed browser diagnostics for review; production and GitHub Actions builds fail if browser acceptance fails. Do not treat a READY preview alone as a passed test.

GitHub Actions uploads `premium-browser-review` with the browser screenshots and JSON diagnostics. The generated `public/diagnostics/premium.json` records actual WebGL tests, not a mocked model or a fallback image.

## Asset scope

The interactive model is a standard Revuelto, not the custom body kit in the reference image. The support frame and assembly order are illustrative, not a factory simulation. See `THIRD_PARTY_NOTICES.md` and `docs/PREMIUM-UPGRADE.md`.
