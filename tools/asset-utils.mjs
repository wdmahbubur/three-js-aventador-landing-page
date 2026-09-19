import path from 'node:path';
import { createHash } from 'node:crypto';

/** Only relative, same-directory glTF assets may be mirrored to the public folder. */
export function safeAssetPath(uri) {
  if (typeof uri !== 'string' || !uri.length || uri.length > 2048) throw new Error('Missing or invalid asset URI.');
  if (uri.startsWith('data:')) return null;
  let decoded;
  try { decoded = decodeURIComponent(uri); } catch { throw new Error(`Malformed asset URI: ${uri}`); }
  if (/^[a-z][a-z\d+.-]*:/i.test(decoded) || decoded.startsWith('/') || /[\\\0?#]/.test(decoded)) throw new Error(`Unsafe asset URI: ${uri}`);
  const segments = decoded.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) throw new Error(`Unsafe asset path: ${uri}`);
  return segments.join('/');
}
export function collectAssets(gltf) {
  if (!gltf || gltf.asset?.version !== '2.0' || !Array.isArray(gltf.nodes) || !gltf.nodes.length) throw new Error('Expected a glTF 2.0 scene with a node hierarchy.');
  const result = new Set();
  for (const item of [...(gltf.buffers || []), ...(gltf.images || [])]) {
    if (item.uri === undefined) continue;
    const relative = safeAssetPath(item.uri);
    if (relative) result.add(relative);
  }
  return [...result];
}
export function destinationFor(root, relative) {
  const name = safeAssetPath(relative);
  if (!name) throw new Error('An inline data URI has no file destination.');
  const resolvedRoot = path.resolve(root), file = path.resolve(resolvedRoot, name);
  if (!file.startsWith(resolvedRoot + path.sep)) throw new Error('Asset destination escapes the model directory.');
  return file;
}
export function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
