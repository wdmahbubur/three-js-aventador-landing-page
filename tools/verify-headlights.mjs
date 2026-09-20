/** Build-time integration test using the downloaded glTF/buffer, not guessed model coordinates. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AssemblyEngine } from '../src/lib/engine.mjs';
import { FINISHES } from '../src/lib/config.mjs';
import { destinationFor } from './asset-utils.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modelDir = path.join(root, 'public/models/revuelto');
// Node has fetch/Event but no browser ProgressEvent; this only supports FileLoader's progress events.
if (!globalThis.ProgressEvent) globalThis.ProgressEvent = class extends Event {
  constructor(type, options = {}) { super(type); Object.assign(this, options); }
};
const json = JSON.parse(await fs.readFile(path.join(modelDir, 'scene.gltf'), 'utf8'));
for (const buffer of json.buffers || []) {
  if (buffer.uri && !buffer.uri.startsWith('data:')) {
    const bytes = await fs.readFile(destinationFor(modelDir, buffer.uri));
    buffer.uri = `data:application/octet-stream;base64,${bytes.toString('base64')}`;
  }
}
// Retain original node transforms/vertices/material names. Texture decoding requires a browser
// and is explicitly NOT being represented by this geometry-only integration test.
json.materials = (json.materials || []).map((m) => ({ name: m.name, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] } }));
json.textures = []; json.images = []; json.samplers = [];
const { scene } = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
const engine = Object.create(AssemblyEngine.prototype);
Object.assign(engine, {
  carRoot: new THREE.Group(), parts: [], paintMaterials: [], lightMaterials: [],
  textures: new Set(), sourceGeometries: new Set(), finish: FINISHES[0], isMobile: false,
  renderer: { capabilities: { getMaxAnisotropy: () => 1 } },
  invalidate() {}
});
engine.prepareModel(scene);
const system = engine.headlightSystem;
assert.equal(system.lamps.length, 2, 'Real asset must yield exactly two headlight projectors');
assert.ok(system.frontMaterials.size > 0, 'The actual headlight emissive materials must be found');
let checks = 2;
for (const progress of [0, .5, .945, .947]) {
  system.update(progress, 0, true);
  assert.equal(system.strength, 0); checks++;
}
system.update(1, 0, true);
const lit = system.getState();
assert.equal(lit.strength, 1); checks++;
assert.ok(Math.hypot(...lit.positions[0].map((v, i) => v - lit.positions[1][i])) > 1);
checks++;
for (let i = 0; i < 2; i++) {
  const lamp = system.lamps[i];
  const origin = lit.positions[i], target = lit.targets[i];
  assert.ok(origin[1] > .1 && origin[1] < 1.3, 'Lamp must be above the floor, on the car');
  assert.ok(target[1] < origin[1]);
  assert.ok(target.reduce((sum, v, axis) => sum + (v - origin[axis]) * lit.forward[axis], 0) > 7.9);
  assert.equal(lamp.light.intensity, 700);
  assert.equal(lamp.light.decay, 2);
  assert.ok(lamp.light.map?.isDataTexture && lamp.light.castShadow);
  assert.ok(lamp.light.target.parent, 'Light target must be part of the scene graph');
  assert.equal(lamp.beam.material.depthWrite, false);
  assert.ok(lamp.beam.visible);
  // A direct ray from the real projector must intersect the road ahead, not behind the car.
  const factor = (origin[1] + .025) / (origin[1] - target[1]);
  assert.ok(factor > 0 && factor < 2);
  checks += 10;
}
system.update(1, 0, false);
assert.ok(system.lamps.every((lamp) => lamp.light.intensity === 0 && !lamp.beam.visible)); checks++;
system.update(1, 1, true);
assert.equal(system.strength, 0); checks++;
system.update(1, 0, true, true);
assert.equal(system.lamps[0].beam.material.uniforms.uStrength.value, .024); checks++;
system.update(.97, 0, true);
const before = system.getState();
system.update(1, 0, true); system.update(.97, 0, true);
assert.deepEqual(system.getState(), before); checks++;
// Attachments follow the physical parts; moving the camera cannot move these origins.
const lamp = system.lamps[0], parent = lamp.anchor.parent;
const saved = parent.position.clone(), x = lamp.light.position.x;
parent.position.x += .2; system.update(1, 0, true);
assert.ok(Math.abs(lamp.light.position.x - x - .2) < 1e-6); checks++;
parent.position.copy(saved); system.update(1, 0, true);
const report = {
  check: 'actual glTF projector geometry and state integration', passed: true, assertions: checks,
  renderedInBrowser: false, source: 'ALIEEEN / Free Lamborghini Revuelto / CC BY 4.0',
  result: system.getState()
};
await fs.mkdir(path.join(root, 'public/diagnostics'), { recursive: true });
await fs.writeFile(path.join(root, 'public/diagnostics/headlights.json'), JSON.stringify(report, null, 2));
console.log('HEADLIGHT_GEOMETRY_VERIFIED', JSON.stringify(report));
const rig = system.rig;
system.dispose(); system.dispose();
assert.equal(rig.parent, null, 'Light rig must be detached during cleanup');
assert.ok(!parent.children.includes(lamp.anchor), 'Aperture anchor must be removed');
console.log('Headlight cleanup verified. GPU shader/visual checks require a browser.');
