/** Validate door extraction against the actual compressed asset before deployment. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { AssemblyEngine } from '../src/lib/engine.mjs';
import { DoorRig } from '../src/lib/doors.mjs';
import { FINISHES } from '../src/lib/config.mjs';
import { CABIN } from '../src/lib/cabin-math.mjs';
if (!globalThis.ProgressEvent) globalThis.ProgressEvent = class extends Event { constructor(type, options = {}) { super(type); Object.assign(this, options); } };
const manifest = JSON.parse(await fs.readFile('public/models/optimized/manifest.json', 'utf8'));
const glb = await fs.readFile('public' + manifest.file), length = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + length).toString());
const binary = glb.subarray(28 + length);
json.buffers[0].uri = 'data:application/octet-stream;base64,' + binary.toString('base64');
// Geometry-only validation. Real browser checks cover texture decoding and rendering.
json.materials = json.materials.map(material => ({ name: material.name, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] } }));
json.textures = []; json.images = []; json.samplers = [];
json.extensionsRequired = json.extensionsRequired.filter(name => name !== 'EXT_texture_webp');
const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(JSON.stringify(json), '');
scene.traverse(node => {
  if (!node.isMesh) return;
  for (const name of ['position', 'normal', 'tangent']) {
    const a = node.geometry.getAttribute(name);
    if (!a || a.array instanceof Float32Array) continue;
    const array = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let j = 0; j < a.itemSize; j++) array[i * a.itemSize + j] = a.getComponent(i, j);
    node.geometry.setAttribute(name, new THREE.Float32BufferAttribute(array, a.itemSize));
  }
});
const engine = Object.create(AssemblyEngine.prototype);
Object.assign(engine, { carRoot: new THREE.Group(), parts: [], paintMaterials: [], lightMaterials: [], textures: new Set(), sourceGeometries: new Set(), finish: FINISHES[0], isMobile: false, renderer: { capabilities: { getMaxAnisotropy: () => 1 } }, invalidate() {} });
engine.prepareModel(scene);
const triangleCount = () => { let n = 0; engine.carRoot.traverse(mesh => { if (mesh.isMesh && mesh.geometry && mesh.visible) n += (mesh.geometry.index?.count || mesh.geometry.attributes.position.count) / 3; }); return n; };
const originalCount = triangleCount(), groups = engine.parts.length;
const doors = new DoorRig(engine.parts);
assert.equal(engine.parts.length, groups);
assert.equal(triangleCount(), originalCount, 'Every source triangle is retained exactly once');
assert.equal(doors.counts.left, doors.counts.right);
assert.ok(doors.counts.left > 1800);
assert.ok(doors.pivots.some(p => /Windows/.test(p.movingMesh.material.name)), 'Door glass must move with the skin');
assert.ok(doors.pivots.some(p => /Interior/.test(p.movingMesh.material.name)), 'Door lining must move with the skin');
engine.carRoot.updateMatrixWorld(true);
const positions = doors.pivots.map(p => p.movingMesh.getWorldPosition(new THREE.Vector3()).toArray());
for (let i = 0; i < 30; i++) { doors.setAmount(1); doors.setAmount(0); }
engine.carRoot.updateMatrixWorld(true);
assert.deepEqual(doors.pivots.map(p => p.movingMesh.getWorldPosition(new THREE.Vector3()).toArray()), positions, 'Repeated closing must not accumulate transform drift');
doors.setAmount(1); engine.carRoot.updateMatrixWorld(true);
for (const side of [-1, 1]) {
  const panel = doors.pivots.find(p => p.side === side && p.movingMesh.material.name === 'Body');
  const box = new THREE.Box3().setFromObject(panel.pivot);
  assert.ok(box.max.y > 1.75 && box.min.y > .1, 'Scissor doors rise above the roof, not below the floor');
}
const steering = engine.parts.find(p => p.key === 'Steering_wheel').center;
assert.ok(Math.abs(CABIN.eye[0] - steering.x) < .1, 'Camera aligns with actual steering wheel');
assert.ok(CABIN.eye[1] > steering.y && CABIN.eye[1] < 1.18);
assert.ok(CABIN.eye[2] < steering.z, 'Driver camera is behind the dashboard');
const report = { passed: true, trianglesPreserved: originalCount, assemblyGroups: groups, doors: doors.getState(), eye: CABIN.eye, steering: steering.toArray() };
doors.dispose(); doors.dispose();
assert.equal(triangleCount(), originalCount, 'Disposal restores the original geometry');
engine.headlightSystem.dispose();
await fs.mkdir('public/diagnostics', { recursive: true });
await fs.writeFile('public/diagnostics/cabin-geometry.json', JSON.stringify(report, null, 2));
console.log('CABIN_GEOMETRY_VERIFIED', JSON.stringify(report));
