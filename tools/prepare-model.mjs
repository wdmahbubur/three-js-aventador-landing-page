import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MODEL } from '../src/lib/config.mjs';
import { collectAssets, destinationFor, sha256 } from './asset-utils.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODEL_DIR = path.join(ROOT, 'public/models/revuelto');
const MANIFEST = path.join(ROOT, 'public/models/manifest.json');
const MAX_FILE_BYTES = 160 * 1024 * 1024;
const MAX_TOTAL_BYTES = 350 * 1024 * 1024;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function download(url, { fetchImpl = fetch, attempts = 3, maximum = MAX_FILE_BYTES } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(60000), headers: { 'User-Agent': 'Revuelto-Assembly-Asset-Preparation/1.0' } });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      if (Number(response.headers.get('content-length')) > maximum) throw new Error(`Asset exceeds the ${maximum}-byte safety limit.`);
      const chunks = []; let length = 0;
      for await (const chunk of response.body) {
        length += chunk.length;
        if (length > maximum) throw new Error(`Asset exceeds the ${maximum}-byte safety limit.`);
        chunks.push(Buffer.from(chunk));
      }
      if (!length) throw new Error(`Empty asset: ${url}`);
      return Buffer.concat(chunks);
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) await sleep(300 * (attempt + 1));
    }
  }
  throw new Error(`Could not retrieve ${url}. ${lastError?.message || lastError}`, { cause: lastError });
}
async function atomicWrite(file, bytes) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  try { await fs.writeFile(temp, bytes); await fs.rename(temp, file); }
  finally { await fs.rm(temp, { force: true }); }
}
async function validCache() {
  try {
    const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
    if (manifest.sourceBase !== MODEL.mirrorBase || manifest.file !== MODEL.local || !manifest.assets?.length) return false;
    for (const asset of manifest.assets) {
      const bytes = await fs.readFile(destinationFor(MODEL_DIR, asset.path));
      if (bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256) return false;
    }
    console.log(`✓ Verified cached free model (${manifest.assets.length} files, ${(manifest.totalBytes / 1048576).toFixed(1)} MiB).`);
    return true;
  } catch { return false; }
}
export async function prepareModel() {
  if (await validCache()) return;
  if (process.env.REVUELTO_ALLOW_REMOTE === '1') {
    await fs.rm(MANIFEST, { force: true });
    console.warn('Remote asset mode enabled. The browser will need access to the public model mirror.');
    return;
  }
  await fs.rm(MANIFEST, { force: true });
  console.log(`Preparing ${MODEL.title} by ${MODEL.author} — free, CC BY 4.0.`);
  console.log('Downloading the public, pinned model and its declared texture/buffer files…');
  const sceneBytes = await download(MODEL.mirrorBase + MODEL.file, { maximum: 16 * 1048576 });
  const gltf = JSON.parse(sceneBytes.toString('utf8'));
  const filenames = collectAssets(gltf);
  const sourceInfo = gltf.asset?.extras || {};
  if (sourceInfo.license && !/CC-BY-4\.0/i.test(sourceInfo.license)) throw new Error('Unexpected source license. Review the downloaded asset before using it.');
  if (sourceInfo.author && !/ALIEEEN/i.test(sourceInfo.author)) throw new Error('Unexpected source attribution. Review the asset before using it.');
  const assets = []; let totalBytes = sceneBytes.length;
  await atomicWrite(path.join(MODEL_DIR, MODEL.file), sceneBytes);
  assets.push({ path: MODEL.file, bytes: sceneBytes.length, sha256: sha256(sceneBytes) });
  let cursor = 0;
  async function worker() {
    while (cursor < filenames.length) {
      const relative = filenames[cursor++];
      const url = new URL(relative.split('/').map(encodeURIComponent).join('/'), MODEL.mirrorBase);
      const bytes = await download(url);
      totalBytes += bytes.length;
      if (totalBytes > MAX_TOTAL_BYTES) throw new Error('Model package exceeds the 350 MiB safety budget.');
      await atomicWrite(destinationFor(MODEL_DIR, relative), bytes);
      assets.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes) });
      console.log(`  ✓ ${relative} (${(bytes.length / 1048576).toFixed(2)} MiB)`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, filenames.length) }, worker));
  const licenseBytes = await download(MODEL.mirrorBase + 'license.txt', { maximum: 1048576 });
  if (!/CC-BY-4\.0/.test(licenseBytes.toString('utf8')) || !/ALIEEEN/.test(licenseBytes.toString('utf8'))) throw new Error('Expected license information is missing.');
  await atomicWrite(path.join(MODEL_DIR, 'license.txt'), licenseBytes);
  assets.push({ path: 'license.txt', bytes: licenseBytes.length, sha256: sha256(licenseBytes) }); totalBytes += licenseBytes.length;
  assets.sort((a, b) => a.path.localeCompare(b.path));
  await atomicWrite(MANIFEST, JSON.stringify({
    version: 1, title: MODEL.title, author: MODEL.author, license: 'CC-BY-4.0',
    source: MODEL.source, sourceBase: MODEL.mirrorBase, file: MODEL.local,
    preparedAt: new Date().toISOString(), totalBytes, assets
  }, null, 2));
  console.log(`✓ Free model ready: ${assets.length} files / ${(totalBytes / 1048576).toFixed(1)} MiB.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  prepareModel().catch((error) => {
    console.error(`\nAsset preparation failed: ${error.message}\nNo paid asset or API key is required. Check your internet connection and rerun npm run assets.\nFor explicit remote-mirror mode: REVUELTO_ALLOW_REMOTE=1 npm run dev`);
    process.exitCode = 1;
  });
}
