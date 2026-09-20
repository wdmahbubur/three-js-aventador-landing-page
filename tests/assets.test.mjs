import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { safeAssetPath, collectAssets, destinationFor, sha256 } from '../tools/asset-utils.mjs';
import { download } from '../tools/prepare-model.mjs';

test('asset paths preserve ordinary nested buffers and textures', () => {
  assert.equal(safeAssetPath('scene.bin'), 'scene.bin');
  assert.equal(safeAssetPath('textures/Body%20paint.png'), 'textures/Body paint.png');
  assert.equal(safeAssetPath('data:application/octet-stream;base64,AAA='), null);
});
test('asset path traversal and external URLs are rejected', () => {
  for (const value of ['../secret', '%2e%2e/secret', '/etc/passwd', '//host/a', 'https://host/a', 'a\\b', 'a/../b', './b', 'a?x', 'a#x', 'a\0b', 'a//b', '', '%EF%ZZ']) assert.throws(() => safeAssetPath(value), undefined, value);
});
test('asset collection validates glTF version and deduplicates references', () => {
  assert.throws(() => collectAssets({ asset: { version: '1.0' }, nodes: [{}] }));
  assert.deepEqual(collectAssets({ asset: { version: '2.0' }, nodes: [{}], buffers: [{ uri: 'scene.bin' }], images: [{ uri: 'textures/a.png' }, { uri: 'textures/a.png' }, { uri: 'data:image/png;base64,AAA=' }, { bufferView: 0 }] }), ['scene.bin', 'textures/a.png']);
});
test('file destinations stay inside the designated model directory', () => {
  assert.equal(destinationFor('/tmp/model', 'textures/a.png'), path.resolve('/tmp/model/textures/a.png'));
  assert.throws(() => destinationFor('/tmp/model', '../escape')); assert.throws(() => destinationFor('/tmp/model', 'data:image/png;base64,AAA='));
});
test('hashing detects content changes', () => {
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.notEqual(sha256('abc'), sha256('abd'));
});
test('downloader accepts successful byte responses', async () => {
  const bytes = await download('https://example.test/scene.bin', { attempts: 1, fetchImpl: async () => new Response(new Uint8Array([1, 2, 3])) });
  assert.deepEqual([...bytes], [1, 2, 3]);
});
test('downloader rejects HTTP errors, empty files and oversized responses', async () => {
  await assert.rejects(download('https://example.test/a', { attempts: 1, fetchImpl: async () => new Response('not found', { status: 404 }) }), /HTTP 404/);
  await assert.rejects(download('https://example.test/a', { attempts: 1, fetchImpl: async () => new Response('') }), /Empty asset/);
  await assert.rejects(download('https://example.test/a', { attempts: 1, maximum: 2, fetchImpl: async () => new Response(new Uint8Array([1, 2, 3])) }), /safety limit/);
  await assert.rejects(download('https://example.test/a', { attempts: 1, maximum: 2, fetchImpl: async () => new Response('a', { headers: { 'content-length': '500' } }) }), /safety limit/);
});
test('downloader retries a transient failure', async () => {
  let calls = 0;
  const result = await download('https://example.test/a', { attempts: 2, fetchImpl: async () => { if (++calls === 1) throw new Error('Temporary DNS issue'); return new Response('ok'); } });
  assert.equal(result.toString(), 'ok'); assert.equal(calls, 2);
});
