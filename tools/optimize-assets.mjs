import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const sourceDir = path.resolve('public/models/revuelto');
const outDir = path.resolve('public/models/optimized');
const sourceManifest = JSON.parse(await fs.readFile('public/models/manifest.json', 'utf8'));
await fs.mkdir(outDir, { recursive: true });
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const document = await io.read(path.join(sourceDir, 'scene.gltf'));
const root = document.getRoot();
const nodesBefore = root.listNodes().map((node) => node.getName()).sort();
const textures = [];
for (const texture of root.listTextures()) {
  const original = texture.getImage();
  if (!original) continue;
  const input = Buffer.from(original);
  const metadata = await sharp(input).metadata();
  const isData = /normal|rough|metal|occlusion/i.test(texture.getName() + ' ' + texture.getURI());
  const bytes = await sharp(input).resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .webp(isData ? { lossless: true, effort: 4 } : { quality: 85, effort: 4, alphaQuality: 100 }).toBuffer();
  texture.setImage(new Uint8Array(bytes)).setMimeType('image/webp').setURI('');
  textures.push({ name: texture.getName(), before: input.length, after: bytes.length,
    originalWidth: metadata.width, originalHeight: metadata.height, dataMap: isData });
}
document.createExtension(EXTTextureWebP).setRequired(true);
// Never join, flatten, instance or simplify meshes: every assembly node stays independent.
await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 16, quantizeNormal: 12, quantizeTexcoord: 14 }));
const nodesAfter = root.listNodes().map((node) => node.getName()).sort();
for (const name of nodesBefore) {
  if (name && !nodesAfter.includes(name)) throw new Error(`Optimization removed the assembly node: ${name}`);
}
const output = await io.writeBinary(document);
const digest = createHash('sha256').update(output).digest('hex');
const filename = `revuelto-${digest.slice(0, 12)}.glb`;
await fs.writeFile(path.join(outDir, filename), output);
const manifest = { version: 2, file: `/models/optimized/${filename}`, bytes: output.length,
  sourceBytes: sourceManifest.totalBytes, reductionPercent: Number((100 * (1 - output.length / sourceManifest.totalBytes)).toFixed(1)),
  sha256: digest, source: sourceManifest.source, author: sourceManifest.author, license: sourceManifest.license,
  meshNodesPreserved: true, nodesBefore: nodesBefore.length, nodesAfter: nodesAfter.length, textures };
await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
// Responsive versions of the user's approved image; the original is not replaced.
for (const width of [640, 960]) {
  await sharp('public/images/reference.webp').resize({ width, withoutEnlargement: true })
    .webp({ quality: 85, effort: 4 }).toFile(`public/images/reference-${width}.webp`);
}
console.log(`Optimized car: ${sourceManifest.totalBytes} → ${output.length} bytes (${manifest.reductionPercent}% smaller). All original node names retained.`);
