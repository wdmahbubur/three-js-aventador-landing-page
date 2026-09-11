# AVENTADOR — Lamborghini Landing Page (Three.js)

A cinematic, single-page landing experience for the Lamborghini Aventador:
real-time PBR 3D car model (GLB), studio reflections, a "live camera" film
rig, film grain / chromatic-aberration post-processing, a viewfinder HUD with
timecode, scroll-driven camera moves, and a live paint configurator.

## Project structure

```
.
├── index.html            # markup + Three.js import map (CDN)
├── style.css             # all styling (HUD, loader, panels, palette…)
├── main.js               # Three.js scene, camera rig, post-processing
├── models/
│   └── aventador.glb     # 13 MB car model (loaded at runtime)
├── vercel.json           # cache headers + security headers
└── README.md
```

No build step — this is a 100% static site. Three.js is loaded from the
jsDelivr CDN via an import map in `index.html`, so the only external
dependency is internet access at page load.

## Deploying to Vercel

### Option A — Drag & drop (fastest, no account tools needed)

1. Zip the contents of this folder (make sure `index.html` ends up at the
   **root** of the zip, not inside a subfolder). A ready-made zip is provided:
   `aventador-landing.zip`.
2. Go to <https://vercel.com/new> and sign in (GitHub / Google / email).
3. Drag the zip (or this whole folder) onto the drop zone.
4. Vercel auto-detects a static site — click **Deploy**.
5. Done — you get a live `https://<name>.vercel.app` URL instantly.

> Note: each drag-and-drop creates a *new* project. To update the same URL
> later, re-drag the new zip or connect a Git repo (Option B).

### Option B — Connect a Git repository (recommended, auto-deploys on push)

1. Create a GitHub/GitLab/Bitbucket repo and push these files:

   ```bash
   git init
   git add .
   git commit -m "Aventador landing page"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```

2. At <https://vercel.com/new> choose **Import Git Repository** and select it.
3. Framework preset: **Other** (or leave "auto-detect"). No build command,
   no output directory needed — the site lives at the repo root.
4. Click **Deploy**. Every future `git push` redeploys automatically.

### Option C — Vercel CLI

```bash
npm i -g vercel
cd aventador-landing      # the folder with index.html
vercel login              # one-time, opens browser to authenticate
vercel                    # preview deploy
vercel --prod             # production deploy
```

## Notes

- The GLB model (~13 MB) is served as a static asset and cached for a year
  via the `Cache-Control` header in `vercel.json`.
- If the page ever shows a blank dark screen, open DevTools → Console: the
  only runtime dependency is the Three.js CDN, so a blocked CDN is the usual
  culprit.
