# Revuelto — Extraordinary, from nothing

A cinematic Next.js + Three.js + GSAP scroll-assembly landing page. This branch is an independent preview; **do not merge into master** unless replacing the existing Aventador website is explicitly intended.

## Run

Use Node.js 22. `npm install`, then `npm run dev`. The predev/prebuild step downloads ALIEEEN's free CC BY 4.0 Revuelto and its declared buffers/textures from a pinned public mirror. No paid model, account, API key, or database is required.

`npm run build` creates the production build. `npm start` serves it. `npm test` covers deterministic animation and safe asset preparation. `npm run typecheck` checks the Next.js application.

## Deployment

The `revuelto-assembly` branch is intended for the existing repository's **Vercel Preview** environment. `vercel.json` explicitly selects Next.js and `.next` output to override the existing static-project defaults without changing production settings.

## Features

Empty opening; reversible part-by-part assembly; camera storyboard; eight chapters; three paint finishes; lighting toggle; exploded view; 360-degree inspection; replay; reduced motion; keyboard navigation; responsive layouts; accessible credits and loading/error state.

## Assets and scope

The actual model is the standard Revuelto, not the custom body kit in the supplied visual reference. The cinematic support frame is illustrative, not a factory-accurate chassis. The assembly is artistic, not an actual factory sequence. See THIRD_PARTY_NOTICES.md. Original code and third-party assets have separate licenses.

Validation and deployment status are recorded separately in the deployment handoff. Do not equate a successful build with a full hardware/WebGL performance test.
