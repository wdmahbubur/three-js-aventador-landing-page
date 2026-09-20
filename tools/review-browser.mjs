/** Run both production acceptance suites sequentially, then export preview thumbnails. */
await import('./verify-browser.mjs');
await import('./verify-cabin-browser.mjs');
const fs = await import('node:fs/promises');
const sharp = (await import('sharp')).default;
const folder = 'public/diagnostics';
if (process.env.VERCEL_ENV === 'preview') {
  for (const name of await fs.readdir(folder)) {
    if (!/^(premium|cabin)-.*\.webp$/.test(name)) continue;
    const bytes = await sharp(`${folder}/${name}`).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 55 }).toBuffer();
    await fs.writeFile(`${folder}/${name}.json`, JSON.stringify({ source: name, encoding: 'base64', image: bytes.toString('base64') }));
  }
}
