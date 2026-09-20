import * as THREE from 'three';
import modelManifest from '../../public/models/optimized/manifest.json';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { AssemblyEngine as HeadlightAssemblyEngine } from './engine.mjs';
import { interval } from './timeline.mjs';
import { renderBudget, nextAdaptiveRatio, QUALITY_MODES } from './performance.mjs';

/** Optimizes the existing real-model assembly, without changing its part hierarchy. */
export class AssemblyEngine extends HeadlightAssemblyEngine {
  constructor(host, options) {
    super(host, options);
    this.active = true;
    this.quality = 'auto';
    this.renderCount = 0;
    this.frameSamples = 0;
    this.frameMean = 16;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.applyQuality();
  }

  buildStudio() {
    super.buildStudio();
    this.renderer.toneMappingExposure = .9;
    this.scene.environmentIntensity = .85;
    this.scene.fog.density = .035;
    this.scene.traverse((object) => {
      if (object.isHemisphereLight) object.intensity = 1.05;
      if (object.isDirectionalLight) object.intensity = object.castShadow ? 2.3 : 1.7;
      if (object.isMesh && object.geometry.type === 'PlaneGeometry' && object.geometry.parameters.width === 90) {
        object.material.color.set(0x141922);
        object.material.roughness = .68;
        object.material.metalness = .13;
      }
    });
  }

  prepareMaterial(original) {
    const material = super.prepareMaterial(original);
    if (/^(body|paint|carpaint|car_paint)$/i.test(original.name || '')) {
      material.metalness = .48;
      material.roughness = .29;
      material.clearcoatRoughness = .16;
    }
    return material;
  }

  prepareModel(source) {
    // The original assembly bakes world transforms into vertex positions. Decode
    // quantized attributes into float buffers first; otherwise integer writes wrap.
    source.traverse((node) => {
      if (!node.isMesh) return;
      for (const name of ['position', 'normal', 'tangent']) {
        const attribute = node.geometry.getAttribute(name);
        if (!attribute || attribute.array instanceof Float32Array) continue;
        const values = new Float32Array(attribute.count * attribute.itemSize);
        for (let i = 0; i < attribute.count; i++) {
          values[i * attribute.itemSize] = attribute.getX(i);
          values[i * attribute.itemSize + 1] = attribute.getY(i);
          if (attribute.itemSize > 2) values[i * attribute.itemSize + 2] = attribute.getZ(i);
          if (attribute.itemSize > 3) values[i * attribute.itemSize + 3] = attribute.getW(i);
        }
        node.geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, attribute.itemSize));
      }
    });
    super.prepareModel(source);
    this.lastPoseProgress = NaN;
    this.lastPoseExplosion = NaN;
    this.renderer.shadowMap.needsUpdate = true;
  }

  async loadModel() {
    // Generated before next build and embedded in the client chunk. No extra fetch,
    // manifest timeout or stale-manifest round trip on the critical loading path.
    const manifest = modelManifest;
    if (!/^\/models\/optimized\/revuelto-[a-f0-9]{12}\.glb$/.test(manifest?.file || '')) {
      throw new Error('The optimized car manifest is invalid. Rebuild the model assets.');
    }
    this.modelBytes = manifest.bytes;
    this.modelSource = 'meshopt-webp';
    this.callbacks.onStatus('Loading the Revuelto…');
    const manager = new THREE.LoadingManager();
    const failures = [];
    manager.onError = (url) => failures.push(url);
    const loader = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
    let timer, expired = false, gltf;
    const loading = loader.loadAsync(manifest.file, (event) => {
      if (!this.destroyed && event.lengthComputable) {
        this.callbacks.onStatus(`Loading Revuelto · ${Math.min(99, Math.round(event.loaded / event.total * 100))}%`);
      }
    }).then((result) => {
      if (expired || this.destroyed) { this.disposeLoaded(result.scene); throw new Error('Loading cancelled'); }
      return result;
    });
    try {
      gltf = await Promise.race([loading, new Promise((_, reject) => {
        timer = setTimeout(() => { expired = true; reject(new Error('Model download timed out.')); }, 90000);
      })]);
    } finally { clearTimeout(timer); }
    if (this.destroyed) return;
    if (failures.length) { this.disposeLoaded(gltf.scene); throw new Error('A car texture failed to decode.'); }
    this.callbacks.onStatus('Preparing the showroom lighting…');
    this.prepareModel(gltf.scene);
    // Compile once before the reveal. Restore the requested pose before the next frame.
    const progress = this.progress;
    this.progress = 1;
    this.applyProgress();
    const compiling = this.renderer.compileAsync(this.scene, this.camera);
    this.progress = progress;
    this.applyProgress();
    await compiling;
    if (this.destroyed) return;
    this.ready = true;
    this.applyProgress();
    this.invalidate();
    this.callbacks.onReady({ parts: this.parts.length, optimized: true });
  }

  applyProgress() {
    // Reuse transforms instead of allocating several arrays and pose objects per mesh/frame.
    const poseChanged = this.progress !== this.lastPoseProgress || this.exploded !== this.lastPoseExplosion;
    if (poseChanged) {
      for (const part of this.parts) {
        const rest = 1 - interval(this.progress, part.start, part.end);
        part.group.visible = this.progress > part.start || this.exploded > 0;
        part.group.position.set(
          part.center.x + part.entry[0] * rest + part.explosion[0] * this.exploded,
          part.center.y + part.entry[1] * rest + part.explosion[1] * this.exploded,
          part.center.z + part.entry[2] * rest + part.explosion[2] * this.exploded
        );
        part.group.rotation.set(part.rotation[0] * rest, part.rotation[1] * rest, part.rotation[2] * rest);
      }
      this.lastPoseProgress = this.progress;
      this.lastPoseExplosion = this.exploded;
    }
    const finish = interval(this.progress, .925, 1);
    for (const material of this.lightMaterials) material.emissiveIntensity = this.lightsOn ? finish * 3.2 : 0;
    this.ring.material.uniforms.uProgress.value = finish;
    this.contact.material.uniforms.uOpacity.value = interval(this.progress, .12, .88) * .72 * (1 - this.exploded * .3);
    this.headlightSystem?.update(this.progress, this.exploded, this.lightsOn, this.isMobile);
    if (poseChanged || this.lastLights !== this.lightsOn) this.renderer.shadowMap.needsUpdate = true;
    this.lastLights = this.lightsOn;
    if (!this.inspect) this.updateCamera();
  }

  applyQuality() {
    if (!this.renderer || !this.width) return;
    const budget = renderBudget({ width: this.width, dpr: devicePixelRatio,
      memory: navigator.deviceMemory || 8, cores: navigator.hardwareConcurrency || 8, quality: this.quality });
    this.renderer.setPixelRatio(budget.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    this.scene.traverse((object) => {
      if (object.isDirectionalLight && object.shadow && object.shadow.mapSize.x !== budget.shadowSize) {
        object.shadow.map?.dispose(); object.shadow.map = null;
        object.shadow.mapSize.setScalar(budget.shadowSize);
      }
    });
    this.textures.forEach((texture) => { texture.anisotropy = Math.min(budget.anisotropy, this.renderer.capabilities.getMaxAnisotropy()); });
    this.renderer.shadowMap.needsUpdate = true;
    this.frameSamples = 0;
    this.invalidate();
  }

  setQuality(quality) {
    if (!QUALITY_MODES.includes(quality)) return;
    this.quality = quality;
    this.applyQuality();
  }
  resize() {
    this.lastPoseProgress = NaN;
    super.resize();
    this.applyQuality();
  }
  setActive(active) {
    this.active = Boolean(active);
    if (!this.active) { cancelAnimationFrame(this.requestId); this.requestId = 0; }
    else { this.lastTime = undefined; this.invalidate(); }
  }
  invalidate() {
    if (this.active === false) return;
    super.invalidate();
  }
  draw(time) {
    if (this.active === false) { this.requestId = 0; return; }
    const elapsed = time - (this.lastSampleTime || time);
    this.lastSampleTime = time;
    if (elapsed > 5 && elapsed < 120) {
      this.frameMean = this.frameMean * .9 + elapsed * .1;
      this.frameSamples++;
      const ratio = nextAdaptiveRatio(this.renderer.getPixelRatio(), this.frameMean, this.frameSamples, this.quality);
      if (ratio !== this.renderer.getPixelRatio()) {
        this.renderer.setPixelRatio(ratio);
        this.renderer.setSize(this.width, this.height, false);
        this.frameSamples = 0;
      }
    }
    super.draw(time);
    this.renderCount = (this.renderCount || 0) + 1;
  }
  getState() {
    return { ...super.getState(), quality: this.quality, pixelRatio: this.renderer.getPixelRatio(),
      active: this.active, renderCount: this.renderCount, optimizedModel: this.modelSource === 'meshopt-webp',
      modelBytes: this.modelBytes || null };
  }
}
