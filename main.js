/* ============================================================
   AVENTADOR — Three.js cinematic engine
   Real-time PBR car + studio reflections + "live camera" rig
   ============================================================ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

/* ------------------------------------------------------------
   Paint palette (name -> body hex, emissive + caliper accents)
   ------------------------------------------------------------ */
const PAINTS = [
  { name: 'GIALLO ORION',    body: '#d1a41a', caliper: '#e8b23a', emis: '#ffd98a', rim: '#ffca4d' },
  { name: 'ARANCIO BOREALIS',body: '#e2631a', caliper: '#2b2b2e', emis: '#ffb07a', rim: '#ff9a3d' },
  { name: 'VERDE MANTIS',    body: '#6fbe3f', caliper: '#2b2b2e', emis: '#c9ff9a', rim: '#a8e063' },
  { name: 'BLU CEPHEUS',     body: '#3f6fbf', caliper: '#e8b23a', emis: '#8fb6ff', rim: '#5c8fe8' },
  { name: 'BIANCO ISIS',     body: '#e9e7df', caliper: '#e8b23a', emis: '#ffffff', rim: '#ffffff' },
  { name: 'NERO NOCTIS',     body: '#0b0b0e', caliper: '#e8b23a', emis: '#ffffff', rim: '#9a9a9e' },
];
const DEFAULT_PAINT = 0;

/* ------------------------------------------------------------
   Boot
   ------------------------------------------------------------ */
const stageEl = document.getElementById('stage');
const canvas = document.createElement('canvas');
stageEl.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04050a);
scene.fog = new THREE.FogExp2(0x04050a, 0.014);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 1.2, 9);

/* ------------------------------------------------------------
   Studio environment (IBL via PMREM) — softboxes & rim glows
   ------------------------------------------------------------ */
function buildEnvironment() {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x000000);

  const softbox = (x, y, z, w, h, color, intensity, lookAt = true) => {
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (lookAt) m.lookAt(0, 0.5, 0);
    m.scale.setScalar(intensity);
    envScene.add(m);
    return m;
  };

  // big overhead key softbox
  softbox(0, 9, 0, 14, 6, 0xffffff, 6);
  // warm side strip
  softbox(8, 2.5, 4, 3, 7, 0xffe9c4, 8);
  // cool opposite strip
  softbox(-9, 2.5, -3, 3, 7, 0xcfe0ff, 6);
  // rear rim glow
  softbox(0, 2.6, -9, 10, 3, 0xffffff, 5);
  // front fill
  softbox(0, 1.4, 9, 12, 3, 0xffffff, 2.4);
  // warm floor bounce
  softbox(0, -0.4, 0, 26, 26, 0xfff2d8, 1.6, false);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(envScene, 0.04);
  scene.environment = rt.texture;
  pmrem.dispose();
  envScene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
}
buildEnvironment();

/* ------------------------------------------------------------
   Lighting
   ------------------------------------------------------------ */
const hemi = new THREE.HemisphereLight(0xdfe6ff, 0x14100c, 0.35);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(6, 10, 7);
scene.add(key);

const rimGold = new THREE.DirectionalLight(0xffc87a, 2.2);
rimGold.position.set(-9, 3, -7);
scene.add(rimGold);

const rimCool = new THREE.DirectionalLight(0x9db8ff, 1.6);
rimCool.position.set(8, 4, -9);
scene.add(rimCool);

const groundSpot = new THREE.SpotLight(0xffe9c4, 30, 40, Math.PI / 4, 0.5, 1.6);
groundSpot.position.set(0, 12, 0);
groundSpot.target.position.set(0, 0, 0);
scene.add(groundSpot, groundSpot.target);

/* ------------------------------------------------------------
   Reflective showroom floor
   ------------------------------------------------------------ */
function buildFloor() {
  const floor = new Reflector(new THREE.CircleGeometry(16, 96), {
    clipBias: 0.003,
    textureWidth: 1024,
    textureHeight: 1024,
    color: 0x0a0c12,
    roughness: 0.9,
  });
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  return floor;
}
const floor = buildFloor();
scene.add(floor);

// soft radial glow under the car
function buildGlowPad() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
  g.addColorStop(0, 'rgba(255,236,190,0.55)');
  g.addColorStop(0.35, 'rgba(255,220,160,0.18)');
  g.addColorStop(1, 'rgba(255,220,160,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.001;
  return mesh;
}
scene.add(buildGlowPad());

/* ------------------------------------------------------------
   Backdrop gradient (cyclorama)
   ------------------------------------------------------------ */
function buildBackdrop() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#0a0d18');
  g.addColorStop(0.55, '#06070d');
  g.addColorStop(1, '#04050a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(c);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 60),
    new THREE.MeshBasicMaterial({ map: tex, fog: false })
  );
  mesh.position.set(0, 14, -30);
  return mesh;
}
scene.add(buildBackdrop());

/* ------------------------------------------------------------
   Load the car
   ------------------------------------------------------------ */
const loader = new GLTFLoader();
const carRoot = new THREE.Group();
scene.add(carRoot);

let car = null;          // model group (inside carRoot)
let carForward = new THREE.Vector3(0, 0, -1);
let carRight = new THREE.Vector3(1, 0, 0);
let carCenter = new THREE.Vector3(0, 0, 0);
let bodyMat = null;
let wheels = [];         // {node, front, axleLocal, baseQuat}
let modelReady = false;

function setPaint(idx) {
  const p = PAINTS[idx];
  if (bodyMat) {
    bodyMat.color.set(p.body);
    bodyMat.metalness = 0.95;
    bodyMat.roughness = 0.32;
  }
  carRoot.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      const n = (m.name || '').toLowerCase();
      if (n.includes('caliper')) m.color.set(p.caliper);
    }
  });
}

function collectWheels() {
  wheels = [];
  const pick = (re) => {
    const out = [];
    carRoot.traverse(o => { if (re.test(o.name || '')) out.push(o); });
    return out;
  };
  let nodes = pick(/wheelhub/i);                 // one group per corner
  if (nodes.length < 2) nodes = pick(/tyre|tire/i);
  if (nodes.length < 2) nodes = pick(/_rim_/i);
  if (nodes.length < 2) return;

  // axle = direction between the two most-separated wheels (left <-> right)
  let bestPair = [nodes[0], nodes[1]], bestD = -1;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = nodes[i].getWorldPosition(new THREE.Vector3())
        .distanceTo(nodes[j].getWorldPosition(new THREE.Vector3()));
      if (d > bestD) { bestD = d; bestPair = [nodes[i], nodes[j]]; }
    }
  }
  const axleWorld = bestPair[1].getWorldPosition(new THREE.Vector3())
    .sub(bestPair[0].getWorldPosition(new THREE.Vector3())).normalize();

  for (const n of nodes) {
    const name = n.name;
    const isFront = /_F[LR]/i.test(name) || /wheelhub[_-]?f/i.test(name) || /front/i.test(name);
    const qp = new THREE.Quaternion();
    (n.parent || carRoot).getWorldQuaternion(qp);
    const axleLocal = axleWorld.clone().applyQuaternion(qp.invert()).normalize();
    wheels.push({ node: n, front: isFront, axleLocal, baseQuat: n.quaternion.clone() });
  }

  // car forward from front/rear wheel centroids
  const fc = new THREE.Vector3(), rc = new THREE.Vector3(); let fn = 0, rn = 0;
  for (const w of wheels) {
    const p = w.node.getWorldPosition(new THREE.Vector3());
    if (w.front) { fc.add(p); fn++; } else { rc.add(p); rn++; }
  }
  if (fn && rn) {
    const fwd = fc.divideScalar(fn).sub(rc.divideScalar(rn));
    if (fwd.lengthSq() > 1e-6) carForward.copy(fwd.normalize());
  }
}

function setupModel(gltf) {
  car = gltf.scene;

  // normalize size & center
  const box = new THREE.Box3().setFromObject(car);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 4.4 / maxDim;
  car.scale.setScalar(scale);

  const box2 = new THREE.Box3().setFromObject(car);
  const c = box2.getCenter(new THREE.Vector3());
  car.position.x -= c.x;
  car.position.z -= c.z;
  car.position.y -= box2.min.y;           // sit on floor

  carRoot.add(car);

  // forward from wheels
  collectWheels();
  if (wheels.length >= 4) {
    const front = new THREE.Vector3(), rear = new THREE.Vector3(); let fn = 0, rn = 0;
    for (const w of wheels) {
      const p = w.node.getWorldPosition(new THREE.Vector3());
      if (w.front) { front.add(p); fn++; } else { rear.add(p); rn++; }
    }
    if (fn && rn) {
      carForward = front.divideScalar(fn).sub(rear.divideScalar(rn)).normalize();
    }
  }
  carRight = new THREE.Vector3().crossVectors(carForward, new THREE.Vector3(0, 1, 0)).normalize();
  if (carRight.lengthSq() < 1e-6) carRight.set(1, 0, 0);

  const box3 = new THREE.Box3().setFromObject(car);
  carCenter = box3.getCenter(new THREE.Vector3());
  carCenter.y = 0;

  // swap the flat paint material (Mt_Body) for a clearcoat physical material,
  // created ONCE and shared by every body panel (so recoloring hits all panels)
  const physMap = new Map();
  car.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i];
      if (m.name === 'Mt_Body') {
        if (!physMap.has(m)) {
          const phys = new THREE.MeshPhysicalMaterial({
            name: 'Mt_Body',
            color: new THREE.Color(PAINTS[DEFAULT_PAINT].body),
            metalness: 0.95,
            roughness: 0.32,
            clearcoat: 1.0,
            clearcoatRoughness: 0.06,
          });
          if (m.normalMap) phys.normalMap = m.normalMap;
          if (m.roughnessMap) phys.roughnessMap = m.roughnessMap;
          if (m.metalnessMap) phys.metalnessMap = m.metalnessMap;
          physMap.set(m, phys);
        }
        const phys = physMap.get(m);
        if (Array.isArray(o.material)) o.material[i] = phys;
        else o.material = phys;
        bodyMat = phys;
      }
    }
  });
  if (!bodyMat) {
    // fallback: recolor the first flat body material found
    car.traverse(o => {
      if (o.isMesh && o.material && !bodyMat) {
        bodyMat = o.material;
        bodyMat.color.set(PAINTS[DEFAULT_PAINT].body);
      }
    });
  }

  // boost emissive lights once for glowing head/tail-light bloom
  car.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      const n = (m.name || '').toLowerCase();
      if (n.includes('emissive') || n.includes('turnlight')) {
        m.emissiveIntensity = 3.0;
        if (n.includes('turnlight')) m.emissive.set(0xffb347);
        else m.emissive.set(0xfff2d0);
      }
    }
  });

  // split merged doors + build scissor-door pivots
  buildMovingParts();

  setPaint(DEFAULT_PAINT);
  modelReady = true;
}

/* ------------------------------------------------------------
   Moving parts — scissor doors
   ------------------------------------------------------------ */
const DOOR_OPEN = THREE.MathUtils.degToRad(68);     // scissor-door swing

const MOVING = {
  doors: { target: 0, current: 0 },
};

let doorPivotL = null, doorPivotR = null;

// The two scissor doors are exported merged into single meshes (both sides in
// one geometry). Split each door mesh at the car centreline (world Z = 0) into
// a left (+Z) and right (−Z) half, baking world-space vertices so the halves
// can be pivoted independently around their own hinges.
function splitMeshByWorldZ(mesh) {
  const g = mesh.geometry;
  if (!g || !g.attributes.position) return null;
  const pos = g.attributes.position, idx = g.index;
  const na = g.attributes.normal, ua = g.attributes.uv;
  const world = new THREE.Matrix4().copy(mesh.matrixWorld);
  const normalMat = new THREE.Matrix3().getNormalMatrix(world);
  const tmp = new THREE.Vector3();

  // world-space Z per vertex (used only to split left vs right)
  const wZ = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    tmp.fromBufferAttribute(pos, i).applyMatrix4(world);
    wZ[i] = tmp.z;
  }

  const L = [], R = [];
  const tz = (a, b, c) => (wZ[a] + wZ[b] + wZ[c]) / 3;
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
      const z = tz(a, b, c);
      if (z > 0.005) L.push(a, b, c); else if (z < -0.005) R.push(a, b, c);
    }
  } else {
    for (let i = 0; i < pos.count; i += 3) {
      const z = tz(i, i + 1, i + 2);
      if (z > 0.005) L.push(i, i + 1, i + 2); else if (z < -0.005) R.push(i, i + 1, i + 2);
    }
  }

  const build = (tris) => {
    if (!tris.length) return null;
    const map = new Map();
    const op = [], on = [], ou = [], oi = [];
    for (const vi of tris) {
      let ni = map.get(vi);
      if (ni === undefined) {
        ni = map.size; map.set(vi, ni);
        // bake WORLD-SPACE position (this was the bug — matrixWorld was skipped)
        tmp.fromBufferAttribute(pos, vi).applyMatrix4(world);
        op.push(tmp.x, tmp.y, tmp.z);
        if (na) {
          tmp.fromBufferAttribute(na, vi).applyMatrix3(normalMat).normalize();
          on.push(tmp.x, tmp.y, tmp.z);
        }
        if (ua) ou.push(ua.getX(vi), ua.getY(vi));
      }
      oi.push(ni);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(op, 3));
    if (na) geo.setAttribute('normal', new THREE.Float32BufferAttribute(on, 3));
    if (ua) geo.setAttribute('uv', new THREE.Float32BufferAttribute(ou, 2));
    geo.setIndex(oi);
    return geo;
  };
  return { left: build(L), right: build(R) };
}

function boxOfMeshes(meshes) {
  const b = new THREE.Box3();
  for (const m of meshes) { m.geometry.computeBoundingBox(); b.union(m.geometry.boundingBox); }
  return b;
}

function buildMovingParts() {
  car.updateMatrixWorld(true);

  // ---- doors (scissor) ----
  const doorMeshNames = new Set(['Mesh_Door_LH', 'Mesh_Door_LH_1', 'Mesh_Door_LH_2']);
  const leftPieces = [], rightPieces = [];
  const removals = [];

  car.traverse(o => {
    if (o.isMesh && doorMeshNames.has(o.name)) {
      const s = splitMeshByWorldZ(o);
      if (s.left) { const m = new THREE.Mesh(s.left, o.material); m.name = o.name + '_L'; leftPieces.push(m); }
      if (s.right) { const m = new THREE.Mesh(s.right, o.material); m.name = o.name + '_R'; rightPieces.push(m); }
    }
    if (o.name === 'Obj_Side_Doors') removals.push(o);
  });
  removals.forEach(r => { if (r.parent) r.parent.remove(r); });

  if (leftPieces.length && rightPieces.length) {
    const bL = boxOfMeshes(leftPieces), bR = boxOfMeshes(rightPieces);
    const frontX = Math.min(bL.min.x, bR.min.x);       // front edge (A-pillar side)
    const hingeY = Math.max(bL.max.y, bR.max.y);       // top edge — scissor hinge line
    const zL = bL.min.z, zR = bR.max.z;                // inner edges (toward car centre)

    doorPivotL = new THREE.Group();
    doorPivotL.position.set(frontX, hingeY, zL);
    leftPieces.forEach(m => { m.position.set(-frontX, -hingeY, -zL); doorPivotL.add(m); });
    carRoot.add(doorPivotL);

    doorPivotR = new THREE.Group();
    doorPivotR.position.set(frontX, hingeY, zR);
    rightPieces.forEach(m => { m.position.set(-frontX, -hingeY, -zR); doorPivotR.add(m); });
    carRoot.add(doorPivotR);
  }
}

function updateMovingParts(dt) {
  const k = 1 - Math.exp(-dt * 5);
  MOVING.doors.current += (MOVING.doors.target - MOVING.doors.current) * k;
  if (doorPivotL) doorPivotL.rotation.x = -DOOR_OPEN * MOVING.doors.current;
  if (doorPivotR) doorPivotR.rotation.x =  DOOR_OPEN * MOVING.doors.current;
}

function togglePart(key) {
  const s = MOVING[key];
  s.target = s.target > 0.5 ? 0 : 1;
  syncPartButtons();
}

function syncPartButtons() {
  const el = document.getElementById('doorBtn');
  if (!el) return;
  const open = MOVING.doors.target > 0.5;
  el.classList.toggle('on', open);
  const em = el.querySelector('em');
  if (em) em.textContent = open ? 'OPEN' : 'CLOSED';
}

/* ------------------------------------------------------------
   Camera rig — "live camera" feel
   ------------------------------------------------------------ */
const shots = [];
function defineShots() {
  const f = carForward, r = carRight, up = new THREE.Vector3(0, 1, 0);
  const P = carCenter;
  const mk = (label, pos, look) => shots.push({ label, pos: pos.clone(), look: look.clone() });
  // text columns: shot0/1/3 → text left, car right; shot2 → text right, car left; shot4 → centered
  mk('SHOT 01 / 05', P.clone().addScaledVector(f, 5.6).addScaledVector(r, 2.8).addScaledVector(up, 1.75), P.clone().addScaledVector(r, 0.4).addScaledVector(up, 0.45));
  mk('SHOT 02 / 05', P.clone().addScaledVector(f, 5.4).addScaledVector(r, 2.6).addScaledVector(up, 0.7), P.clone().addScaledVector(r, 0.1).addScaledVector(up, 0.35));
  mk('SHOT 03 / 05', P.clone().addScaledVector(r, 7.5).addScaledVector(up, 1.0), P.clone().addScaledVector(f, 0.8).addScaledVector(up, 0.4));
  mk('SHOT 04 / 05', P.clone().addScaledVector(f, -5.2).addScaledVector(r, -2.6).addScaledVector(up, 1.25), P.clone().addScaledVector(r, -0.1).addScaledVector(up, 0.5));
  mk('SHOT 05 / 05', P.clone().addScaledVector(f, 5.2).addScaledVector(up, 0.5), P.clone().addScaledVector(up, 0.4));
}

const smoothLook = new THREE.Vector3(0, 0.4, 0);
let smoothRadius = 6.5, smoothTheta = Math.PI, smoothPhi = 1.3;

let dragYaw = 0, dragPitch = 0, dragYawV = 0, dragPitchV = 0;
let targetYaw = 0, targetPitch = 0;

const camState = {
  shakeAmp: 0.05,
  focusT: 0,
  bump: 0,
  baseFov: 38,
};

/* ------------------------------------------------------------
   Post-processing
   ------------------------------------------------------------ */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight), 0.9, 0.55, 0.8
);
composer.addPass(bloom);

const rgbShift = new ShaderPass(RGBShiftShader);
rgbShift.uniforms['amount'].value = 0.0018;
rgbShift.renderToScreen = true;
composer.addPass(rgbShift);

/* ------------------------------------------------------------
   Film grain overlay (CSS canvas, blended on top)
   ------------------------------------------------------------ */
const grainEl = (() => {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', inset: '0', zIndex: '24', pointerEvents: 'none',
    mixBlendMode: 'overlay', opacity: '0.16', backgroundSize: '140px 140px',
    backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22140%22 height=%22140%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/></filter><rect width=%22140%22 height=%22140%22 filter=%22url(%23n)%22/></svg>")',
  });
  document.body.appendChild(el);
  return el;
})();

/* ------------------------------------------------------------
   HUD: timecode + shot label
   ------------------------------------------------------------ */
const tcEl = document.getElementById('timecode');
const shotEl = document.getElementById('shotLabel');
const TC_START = (2 * 3600 + 14 * 60 + 7) * 24 + 19;
function fmtTC(frames) {
  const f = Math.max(0, Math.floor(frames));
  const ff = f % 24, ss = Math.floor(f / 24) % 60, mm = Math.floor(f / 3600) % 60, hh = Math.floor(f / 86400) % 24;
  const p = n => String(n).padStart(2, '0');
  return `${p(hh)}:${p(mm)}:${p(ss)}:${p(ff)}`;
}

/* ------------------------------------------------------------
   Scroll → shot selection (polled every frame for reliability)
   ------------------------------------------------------------ */
let curShot = 0;
function readScrollShot() {
  if (shots.length === 0) return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const p = max > 0 ? window.scrollY / max : 0;
  const s = Math.round(p * (shots.length - 1));
  if (s !== curShot) {
    curShot = s;
    camState.bump = 1;              // whip-pan impulse
    if (shotEl) shotEl.textContent = shots[curShot].label;
  }
}

/* ------------------------------------------------------------
   Pointer look (drag) + parallax
   ------------------------------------------------------------ */
let dragging = false, lastX = 0, lastY = 0, mouseNX = 0, mouseNY = 0;
window.addEventListener('pointerdown', e => {
  dragging = true; lastX = e.clientX; lastY = e.clientY;
});
window.addEventListener('pointermove', e => {
  mouseNX = (e.clientX / window.innerWidth) * 2 - 1;
  mouseNY = (e.clientY / window.innerHeight) * 2 - 1;
  if (dragging) {
    dragYaw += (e.clientX - lastX) * 0.005;
    dragPitch += (e.clientY - lastY) * 0.005;
    lastX = e.clientX; lastY = e.clientY;
  }
});
window.addEventListener('pointerup', () => { dragging = false; });
window.addEventListener('pointercancel', () => { dragging = false; });

/* ------------------------------------------------------------
   Palette UI
   ------------------------------------------------------------ */
const paletteRow = document.getElementById('paletteRow');
const paletteName = document.getElementById('paletteName');
PAINTS.forEach((p, i) => {
  const s = document.createElement('div');
  s.className = 'swatch' + (i === DEFAULT_PAINT ? ' active' : '');
  s.style.background = p.body;
  s.title = p.name;
  s.addEventListener('click', () => {
    document.querySelectorAll('.swatch').forEach(x => x.classList.remove('active'));
    s.classList.add('active');
    setPaint(i);
    paletteName.textContent = p.name;
  });
  paletteRow.appendChild(s);
});
paletteName.textContent = PAINTS[DEFAULT_PAINT].name;

/* ------------------------------------------------------------
   Cinema mode
   ------------------------------------------------------------ */
const cinemaBtn = document.getElementById('cinemaBtn');
const watchBtn = document.getElementById('watchBtn');
function toggleCinema() {
  document.body.classList.toggle('cinema');
  cinemaBtn.textContent = document.body.classList.contains('cinema') ? '◱ EXIT CINEMA' : '◱ CINEMA';
}
cinemaBtn.addEventListener('click', toggleCinema);
watchBtn.addEventListener('click', toggleCinema);

/* ------------------------------------------------------------
   Moving parts UI (doors)
   ------------------------------------------------------------ */
const doorBtn = document.getElementById('doorBtn');
if (doorBtn) doorBtn.addEventListener('click', () => togglePart('doors'));

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key.toLowerCase() === 'd') togglePart('doors');
});
syncPartButtons();

/* ------------------------------------------------------------
   Loader progress
   ------------------------------------------------------------ */
const loaderEl = document.getElementById('loader');
const loaderFill = document.getElementById('loaderFill');
const loaderPct = document.getElementById('loaderPct');
const loaderTip = document.getElementById('loaderTip');
const TIPS = ['WAKING THE V12…', 'POLISHING THE CLEARCOAT…', 'ALIGNING THE Y-SIGNATURE…', 'CALIBRATING THE RIG…'];
let tipI = 0;
const tipTimer = setInterval(() => { tipI = (tipI + 1) % TIPS.length; loaderTip.textContent = TIPS[tipI]; }, 900);
let fake = 0;
const fakeTimer = setInterval(() => {
  fake = Math.min(fake + 0.016 + Math.random() * 0.02, 0.9);
  loaderFill.style.width = (fake * 100).toFixed(0) + '%';
  loaderPct.textContent = (fake * 100).toFixed(0) + '%';
}, 60);

loader.load(
  './models/aventador.glb',
  gltf => {
    setupModel(gltf);
    defineShots();
    const off0 = shots[0].pos.clone().sub(carCenter);
    smoothRadius = Math.max(off0.length(), 4.2);
    smoothTheta = Math.atan2(off0.x, off0.z);
    smoothPhi = Math.acos(THREE.MathUtils.clamp(off0.y / smoothRadius, -1, 1));
    smoothLook.copy(shots[0].look);
    readScrollShot();
  },
  undefined,
  err => { console.error('GLB load error', err); loaderTip.textContent = 'MODEL ERROR — SEE CONSOLE'; }
);

/* ------------------------------------------------------------
   Animation loop
   ------------------------------------------------------------ */
const clock = new THREE.Clock();
let t = 0, tcFrames = TC_START;

function updateCamera(dt) {
  if (shots.length === 0) return;

  const shot = shots[curShot];
  const k = 1 - Math.exp(-dt * 3.2);
  smoothLook.lerp(shot.look, k);

  // camera swings around the car on a sphere — never clips through the body
  const off = shot.pos.clone().sub(carCenter);
  const targetRadius = Math.max(off.length(), 4.2);
  const targetTheta = Math.atan2(off.x, off.z);
  const targetPhi = Math.acos(THREE.MathUtils.clamp(off.y / targetRadius, -1, 1));

  smoothRadius += (targetRadius - smoothRadius) * k;
  let dTheta = targetTheta - smoothTheta;
  dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));   // shortest arc
  smoothTheta += dTheta * k;
  smoothPhi += (targetPhi - smoothPhi) * k;

  // drag orbit + pointer parallax
  const pyaw = mouseNX * 0.16;
  const ppitch = -mouseNY * 0.1;
  if (!dragging) {
    dragYawV += (0 - dragYaw) * 0.02;
    dragPitchV += (0 - dragPitch) * 0.02;
  } else {
    dragYawV = 0; dragPitchV = 0;
  }
  targetYaw = dragYaw + pyaw + dragYawV;
  targetPitch = dragPitch + ppitch + dragPitchV;
  dragPitch = Math.max(-0.9, Math.min(0.9, dragPitch));

  const theta = smoothTheta + targetYaw;
  const phi = THREE.MathUtils.clamp(smoothPhi + targetPitch, 0.12, Math.PI - 0.12);
  const radius = smoothRadius;

  camera.position.set(
    carCenter.x + radius * Math.sin(phi) * Math.sin(theta),
    carCenter.y + radius * Math.cos(phi),
    carCenter.z + radius * Math.sin(phi) * Math.cos(theta)
  );

  // handheld shake (sum of sines + damped bump impulse)
  camState.bump = Math.max(0, camState.bump - dt * 1.8);
  const amp = camState.shakeAmp + camState.bump * 0.09;
  const s1 = 1.6, s2 = 2.7, s3 = 4.1;
  const shx = (Math.sin(t * s1 * 2.4) * 0.6 + Math.sin(t * s2 * 1.8) * 0.4) * amp;
  const shy = (Math.sin(t * s3 * 2.1 + 1.7) * 0.6 + Math.sin(t * s1 * 1.3 + 0.4) * 0.4) * amp;
  const shz = (Math.sin(t * s2 * 2.6 + 2.2) * 0.7) * amp;
  camera.position.x += shx; camera.position.y += shy; camera.position.z += shz;

  camera.lookAt(smoothLook);

  // roll jitter
  const roll = (Math.sin(t * 1.9 + 0.8) * 0.5 + Math.sin(t * 3.7) * 0.5) * 0.0016 + camState.bump * 0.004;
  camera.rotateZ(roll);

  // focus breathing
  camState.focusT += dt;
  const breathe = Math.sin(camState.focusT * 0.7) * 0.5 + Math.sin(camState.focusT * 1.3) * 0.5;
  camera.fov = camState.baseFov + breathe * 0.55;
  camera.updateProjectionMatrix();
}

const _steerAxis = new THREE.Vector3(0, 1, 0);
const _steerQ = new THREE.Quaternion();
const _spinQ = new THREE.Quaternion();

function updateCar(dt) {
  if (!car) return;
  const spin = dt * 0.7;
  const steer = Math.sin(t * 0.5) * 0.09;
  _steerQ.setFromAxisAngle(_steerAxis, steer);
  for (const w of wheels) {
    _spinQ.setFromAxisAngle(w.axleLocal, spin);
    w.node.quaternion.copy(w.baseQuat);
    if (w.front) w.node.quaternion.multiply(_steerQ);
    w.node.quaternion.multiply(_spinQ);
  }
  // idle suspension bob
  carRoot.position.y = Math.sin(t * 0.9) * 0.008;
}

let loaded = false;
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.1);
  t += dt;
  tcFrames += dt * 24;

  readScrollShot();
  updateCamera(dt);
  updateCar(dt);
  updateMovingParts(dt);

  // timecode
  tcEl.textContent = fmtTC(tcFrames);

  // bloom pulse (headlights feel)
  bloom.strength = 0.85 + Math.sin(t * 0.8) * 0.06;
  rgbShift.uniforms['amount'].value = 0.0016 + Math.sin(t * 1.1) * 0.0005 + camState.bump * 0.003;

  composer.render();

  // reveal once model is ready
  if (modelReady && !loaded) {
    loaded = true;
    clearInterval(tipTimer);
    clearInterval(fakeTimer);
    loaderFill.style.width = '100%';
    loaderPct.textContent = '100%';
    setTimeout(() => {
      loaderEl.classList.add('done');
      document.body.classList.add('loaded');
    }, 250);
  }
}
tick();

/* ------------------------------------------------------------
   Resize
   ------------------------------------------------------------ */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('scroll', readScrollShot, { passive: true });
window.addEventListener('wheel', readScrollShot, { passive: true });

