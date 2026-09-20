/** Build-only visual review thumbnails. Never included in the application JS. */
import './verify-browser.mjs';
import fs from 'node:fs/promises';
import sharp from 'sharp';
const folder = 'public/diagnostics';
if (process.env.VERCEL_ENV === 'preview') {
  for (const name of await fs.readdir(folder)) {
    if (!/^premium-.*\.webp$/.test(name)) continue;
    const bytes = await sharp(`${folder}/${name}`).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 55 }).toBuffer();
    await fs.writeFile(`${folder}/${name}.json`, JSON.stringify({ source: name, encoding: 'base64', image: bytes.toString('base64') }));
  }
}
