# Premium presentation and performance upgrade

The existing car model, part hierarchy, forward headlight system, approved reference image and creator attribution are retained.

## Presentation

Manrope body text and Barlow Condensed display type through Next.js font optimization; warm-metal accents and a charcoal showroom; cleaner specification and design sections; unified finish/inspection controls; mobile and landscape layouts; keyboard focus states and reduced-motion handling.

## Performance

A build-time meshopt-compressed GLB combines the model geometry and WebP textures. Original node names are checked; meshes are never joined or simplified. Quantized position, normal and tangent attributes are converted to float buffers before the existing renderer bakes transforms. The source assets remain available as fallback and for the original geometry tests.

The optimized asset gets a content-hashed filename with long-lived immutable caching. Its manifest is revalidated so a new deployment cannot point users at a stale hash. Responsive 640/960 pixel variants retain the user-approved reference image. The fallback image does not download on the critical path.

Rendering uses a device-aware resolution budget, a manual Auto/High/Eco control, on-demand frames, offscreen pausing, cached shadows, and allocation-free part transforms. Data Saver requires explicit opt-in before downloading the 3D model. Loading is deferred until after the first paint. No analytics or tracking is added.

## Verification

`npm test` includes the existing suites and the new deterministic render-policy tests. `npm run verify:headlights` retains the source-model geometry check. `npm run build` then runs real Chromium/software-WebGL checks through `npm run verify:browser`.

The generated report is `public/diagnostics/premium.json`. It distinguishes real model loading from a static fallback, checks assembly reversal, projected lights, paint, explosion, keyboard inspection, responsive layout, rendering suspension, reduced motion and Data Saver. Screenshots are generated beside it.

Preview builds publish diagnostics even on browser-test failure so the report can be inspected; production builds fail if the browser suite fails. A READY preview alone is not evidence of a passed browser test. Hardware frame-rate and real-user performance measurements are not claimed by the software-renderer tests.
