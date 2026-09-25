import { MaterialConfigurator } from '../src/lib/material-configurator.mjs';
import { HotspotProjector } from '../src/lib/hotspots.mjs';
import { CONFIG_OPTIONS, DEFAULT_CONFIGURATION } from '../src/lib/configuration.mjs';
/** Validate material isolation and landmark projection on the actual compressed asset. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { AssemblyEngine } from '../src/lib/engine.mjs';
import { DoorRig } from '../src/lib/doors.mjs';
import { FINISHES } from '../src/lib/config.mjs';
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

const rig = new DoorRig(engine.parts);
const topology = () => { let n=0; engine.carRoot.traverse(o=>{if(o.isMesh && o.visible && o.geometry?.attributes.position)n+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});return n; };
const before=topology();
const configurator = new MaterialConfigurator(engine.parts);
assert.ok(Object.values(configurator.capabilities()).every(Boolean), 'Every displayed option has real material bindings');
assert.notEqual(configurator.slots.get('seats')[0].material,configurator.slots.get('accents')[0].material,'Shared source cabin colours are isolated');
let assertions=3;
for(const [key,options] of Object.entries(CONFIG_OPTIONS))for(const option of options){
 configurator.apply({...DEFAULT_CONFIGURATION,[key]:option.id});assert.equal(configurator.configuration[key],option.id);assert.equal(topology(),before);assertions+=2;
 if(option.color&&option.id!=='original'){for(const binding of configurator.slots.get(key)||[]){assert.equal('#'+binding.material.color.getHexString(),option.color);assertions++;}}
}
configurator.apply({...DEFAULT_CONFIGURATION,seats:'ivory',accents:'rosso',paintFinish:'matte'});
assert.notEqual(configurator.slots.get('seats')[0].material.color.getHex(),configurator.slots.get('accents')[0].material.color.getHex());
assert.ok(configurator.slots.get('paint')[0].material.roughness>.6);assertions+=2;
for(const part of engine.parts){part.group.visible=true;part.group.position.copy(part.center);part.group.rotation.set(0,0,0);}
engine.carRoot.updateMatrixWorld(true);
const projector=new HotspotProjector(engine.parts,rig,{clientWidth:1000,clientHeight:650});
projector.bind(projector.anchors.map(a=>({dataset:{hotspot:a.id},style:{},hidden:true})));
projector.setEnabled(true);
const camera=new THREE.PerspectiveCamera(40,1000/650,.05,80);camera.position.set(5.4,2.1,7.5);camera.lookAt(0,.64,0);camera.updateProjectionMatrix();
projector.update(camera,engine.carRoot);const front=structuredClone(projector.last);
assert.ok(front.filter(x=>x.visible).length>=2,'Front view exposes actual clickable landmarks');assert.ok(front.every(x=>Number.isFinite(x.x)&&Number.isFinite(x.y)));assertions+=2;
for (let i=0;i<front.length;i++) for(let j=i+1;j<front.length;j++) if(front[i].visible&&front[j].visible) assert.ok(Math.hypot(front[i].x-front[j].x,front[i].y-front[j].y)>=48,'Visible landmark targets must not overlap');
assertions++;
camera.position.set(-5,2,-7);camera.lookAt(0,.7,0);projector.update(camera,engine.carRoot);
assert.equal(projector.last.find(x=>x.id==='headlights').visible,false,'Rear camera must not see a front-facing headlight marker');assertions++;
const report={passed:true,assertions,triangles:before,groups:engine.parts.length,capabilities:configurator.capabilities(),frontMarkers:front,rearMarkers:projector.last,materialGroups:[...configurator.slots.keys()]};
configurator.dispose();rig.dispose();projector.dispose();assert.equal(topology(),before);
engine.headlightSystem.dispose();
await fs.mkdir('public/diagnostics',{recursive:true});await fs.writeFile('public/diagnostics/configuration-geometry.json',JSON.stringify(report,null,2));console.log('CONFIGURATION_GEOMETRY_VERIFIED',JSON.stringify(report));
