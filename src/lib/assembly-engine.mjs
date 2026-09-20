import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { MODEL, FINISHES } from './config.mjs';
import { cameraPose, classifyPart, entryOffset, hashString, interval, partPose, partWindow } from './timeline.mjs';

const point = new THREE.Vector3();

/** Disposable Three.js scene. Every part transform is reconstructed from scroll progress. */
export class AssemblyEngine {
  constructor(host, { onStatus = () => {}, onReady = () => {}, onError = () => {}, onExitInspect = () => {}, reduced = false } = {}) {
    this.host = host;
    this.callbacks = { onStatus, onReady, onError, onExitInspect };
    this.reduced = reduced;
    this.progress = reduced ? 1 : 0;
    this.parts = [];
    this.paintMaterials = [];
    this.lightMaterials = [];
    this.ready = false;
    this.destroyed = false;
    this.inspect = false;
    this.exploded = 0;
    this.explodeTarget = 0;
    this.lightsOn = true;
    this.finish = FINISHES[0];
    this.requestId = 0;
    this.abort = new AbortController();
    this.textures = new Set();
    this.resources = new Set();
    this.sourceGeometries = new Set();
    this.isMobile = host.clientWidth < 760;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0b0d11, .028);
    this.camera = new THREE.PerspectiveCamera(35, 1, .05, 80);
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (error) {
      this.abort.abort();
      throw new Error('WebGL could not start on this browser.', { cause: error });
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.isMobile ? 1.25 : 1.75));
    this.renderer.setClearColor(0x090a0b, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', '3D Lamborghini assembly. Scroll to assemble the car. After the reveal, choose Inspect 360 degrees to rotate it.');
    this.host.appendChild(canvas);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enabled = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = .12;
    this.controls.enablePan = false;
    this.controls.enableZoom = true;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 25;
    this.controls.minPolarAngle = .35;
    this.controls.maxPolarAngle = Math.PI / 2 - .025;
    this.controls.touches.ONE = THREE.TOUCH.ROTATE;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    this.controls.addEventListener('change', () => this.invalidate());
    canvas.addEventListener('keydown', (event) => this.onKey(event), { signal: this.abort.signal });
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      if (!this.destroyed) this.callbacks.onError(new Error('The graphics context was lost. Retry the 3D experience.'));
    }, { signal: this.abort.signal });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(this.requestId); this.requestId = 0; }
      else this.invalidate();
    }, { signal: this.abort.signal });
    this.buildStudio();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.loadModel().catch((error) => { if (!this.destroyed) this.callbacks.onError(error); });
  }

  buildStudio() {
    const hemisphere = new THREE.HemisphereLight(0xe4e9ff, 0x252022, 1.7);
    this.scene.add(hemisphere);
    const key = new THREE.DirectionalLight(0xfff8ec, 3.4);
    key.position.set(-3, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.setScalar(this.isMobile ? 512 : 1024);
    key.shadow.camera.left = -7; key.shadow.camera.right = 7;
    key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
    key.shadow.normalBias = .035;
    key.shadow.bias = -.0002;
    key.shadow.camera.near = .5; key.shadow.camera.far = 25;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xb7cfff, 2.2);
    rim.position.set(3, 3, -5); this.scene.add(rim);
    RectAreaLightUniformsLib.init();
    const softbox = new THREE.RectAreaLight(0xffffff, 5, 6, 3);
    softbox.position.set(-3, 5, 1); softbox.lookAt(0, .6, 0); this.scene.add(softbox);
    const redbox = new THREE.RectAreaLight(0xff392a, 1.8, 4, 1.5);
    redbox.position.set(4, 2, -2); redbox.lookAt(0, .6, 0); this.scene.add(redbox);
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const environmentTarget = pmrem.fromScene(environment, .04);
    this.scene.environment = environmentTarget.texture;
    this.scene.environmentIntensity = 1.15;
    this.resources.add(environmentTarget);
    environment.dispose(); pmrem.dispose();

    const texture = this.concreteTexture();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ color: 0x25272c, roughness: .6, metalness: .12, map: texture }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.025; floor.receiveShadow = true; this.scene.add(floor);
    const ringMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uProgress: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `varying vec2 vUv; uniform float uProgress;
        void main(){vec2 p=(vUv-.5)*2.; float r=length(p);
          float a=fwidth(r)*1.5;
          float ring=1.-smoothstep(a,a+.004,abs(r-.81));
          float halo=exp(-abs(r-.81)*65.)*.16;
          vec3 c=mix(vec3(.4,.44,.5),vec3(.85,.10,.065),uProgress);
          gl_FragColor=vec4(c,(ring*.17+halo)*(1.-smoothstep(.9,1.,r)));}`
    });
    this.ring = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), ringMaterial);
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = -.019; this.scene.add(this.ring);
    const contactMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying vec2 vUv;uniform float uOpacity;void main(){vec2 p=(vUv-.5)*2.;float a=pow(max(0.,1.-dot(p,p)),1.4);gl_FragColor=vec4(vec3(0.),a*uOpacity);}'
    });
    this.contact = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 6.6), contactMaterial);
    this.contact.rotation.x = -Math.PI / 2; this.contact.position.y = -.012; this.scene.add(this.contact);
    this.carRoot = new THREE.Group(); this.scene.add(this.carRoot);
  }

  concreteTexture() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const data = ctx.createImageData(128, 128); let seed = 34128;
    for (let i = 0; i < data.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const gray = 118 + (seed % 23);
      data.data.set([gray, gray, gray + 2, 255], i);
    }
    ctx.putImageData(data, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(30, 30); texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.add(texture); return texture;
  }

  async loadModel() {
    this.callbacks.onStatus('Locating the free Revuelto model…');
    let url = MODEL.mirrorBase + MODEL.file;
    if (location.protocol !== 'file:') {
      try {
        const response = await fetch('/models/manifest.json', { signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(5000)]) });
        if (response.ok) {
          const manifest = await response.json();
          if (manifest.file === MODEL.local) url = MODEL.local;
        }
      } catch (error) { if (this.destroyed) return; }
    }
    const manager = new THREE.LoadingManager();
    const failedAssets = new Set();
    manager.onError = (assetUrl) => failedAssets.add(assetUrl);
    manager.onProgress = (_, loaded, total) => {
      if (!this.destroyed && !this.ready) this.callbacks.onStatus(`Loading assets ${loaded} / ${total}…`);
    };
    const loader = new GLTFLoader(manager);
    let timer;
    let expired = false;
    const loading = loader.loadAsync(url).then((result) => {
      if (expired || this.destroyed) { this.disposeLoaded(result.scene); throw new Error('Model loading cancelled.'); }
      return result;
    });
    try {
      const gltf = await Promise.race([
        loading,
        new Promise((_, reject) => { timer = setTimeout(() => { expired = true; reject(new Error('The free model took too long to load. Check your connection and retry.')); }, 90000); })
      ]);
      if (this.destroyed) return;
      if (failedAssets.size) { this.disposeLoaded(gltf.scene); throw new Error('Some model textures or buffers failed to load. Retry on a reliable connection.'); }
      this.callbacks.onStatus('Preparing parts and materials…');
      try { this.prepareModel(gltf.scene); } catch (error) { this.disposeLoaded(gltf.scene); throw error; }
      this.ready = true;
      this.applyProgress();
      this.invalidate();
      this.callbacks.onReady({ parts: this.parts.length, source: MODEL.source, modelUrl: url });
    } finally { clearTimeout(timer); }
  }

  logicalKey(mesh) {
    const wheel = mesh.name.match(/Wheel[_ .-]*(FR|FL|BR|BL|RR|RL)/i);
    if (wheel) return `Wheel_${wheel[1].toUpperCase()}`;
    const parent = mesh.parent;
    if (parent?.name && parent.children.every((child) => child.isMesh) && !/^(Sketchfab|RootNode|Scene|Object_)/i.test(parent.name)) return parent.name;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    let name = mesh.name.replace(/_\d+$/, '');
    const suffix = material?.name?.replace(/[\[\].:/]/g, '');
    if (suffix && name.toLowerCase().endsWith(`_${suffix.toLowerCase()}`)) name = name.slice(0, -suffix.length - 1);
    return name || mesh.uuid;
  }

  prepareModel(source) {
    source.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(source);
    const size = bounds.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.length()) || size.length() < .001) throw new Error('The downloaded model has no usable geometry.');
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 4.95 / Math.max(size.x, size.z);
    const normalize = new THREE.Matrix4().makeScale(scale, scale, scale).multiply(new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z));
    const groups = new Map(); const materialCache = new Map();
    source.traverse((node) => {
      if (!node.isMesh || !node.geometry) return;
      const key = this.logicalKey(node);
      if (!groups.has(key)) groups.set(key, { meshes: [], materialNames: [] });
      const entry = groups.get(key);
      const originals = Array.isArray(node.material) ? node.material : [node.material];
      const materials = originals.map((original) => {
        entry.materialNames.push(original.name);
        if (!materialCache.has(original)) materialCache.set(original, this.prepareMaterial(original));
        return materialCache.get(original);
      });
      const geometry = node.geometry.clone();
      geometry.applyMatrix4(normalize.clone().multiply(node.matrixWorld));
      const mesh = new THREE.Mesh(geometry, Array.isArray(node.material) ? materials : materials[0]);
      mesh.name = node.name; mesh.castShadow = true; mesh.receiveShadow = true;
      entry.meshes.push(mesh);
      this.sourceGeometries.add(node.geometry);
    });
    if (groups.size < 4) throw new Error('This asset does not contain enough separate components for the assembly.');
    for (const [key, entry] of groups) {
      const category = classifyPart(key, entry.materialNames.join(' '));
      const group = new THREE.Group(); group.name = key;
      entry.meshes.forEach((mesh) => group.add(mesh));
      const center = new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3());
      entry.meshes.forEach((mesh) => mesh.geometry.translate(-center.x, -center.y, -center.z));
      group.position.copy(center);
      group.visible = false;
      this.carRoot.add(group);
      this.addPart(group, category, center, key);
    }
    this.addIllustrativeSupport();
    for (const geometry of this.sourceGeometries) geometry.dispose();
    this.sourceGeometries.clear();
    for (const original of materialCache.keys()) original.dispose();
    this.setFinish(this.finish.id);
  }

  prepareMaterial(original) {
    for (const value of Object.values(original)) if (value?.isTexture) {
      this.textures.add(value);
      value.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    }
    const name = (original.name || '').toLowerCase();
    let material;
    if (/^(body|paint|carpaint|car_paint)$/.test(name)) {
      material = new THREE.MeshPhysicalMaterial({
        color: this.finish.color, metalness: .65, roughness: .25,
        clearcoat: 1, clearcoatRoughness: .12,
        normalMap: original.normalMap || null,
        roughnessMap: original.roughnessMap || null,
        side: THREE.DoubleSide
      });
      material.name = original.name; this.paintMaterials.push(material);
    } else {
      material = original.clone();
      if ('envMapIntensity' in material) material.envMapIntensity = 1.0;
      if (/carbon/.test(name)) { material.color.set(0x171b20); material.roughness = .43; material.metalness = .35; }
      if (/tire|tyre/.test(name)) { material.color.set(0x14151a); material.roughness = .91; material.metalness = .02; }
      if (/^rim$|^material$/.test(name)) { material.color.set(0x41444b); material.metalness = .9; material.roughness = .24; }
      if (/glass|window|windscreen/.test(name)) {
        material.transparent = true; material.depthWrite = false;
        material.opacity = /head|tail|light/.test(name) ? .25 : .43;
        material.roughness = .12; material.metalness = .1;
      }
      if (/caliper/.test(name)) material.color.set(0xba2921);
      if (/^light$|headlight_light|headlight_ligh_second|^tail_light$|tail_light_brake/.test(name)) {
        material.emissive = new THREE.Color(/tail/.test(name) ? 0xff1707 : 0xe9f3ff);
        material.emissiveIntensity = 0;
        this.lightMaterials.push(material);
      }
    }
    return material;
  }

  addPart(group, category, center, key) {
    const [start, end] = partWindow(category, key);
    const hash = hashString(key);
    const rotation = category === 'wheels' ? [0, 0, 0] : [((hash % 7) - 3) * .035, ((hash % 11) - 5) * .035, ((hash % 5) - 2) * .03];
    const side = Math.abs(center.x) > .08 ? Math.sign(center.x) : (hash % 2 ? 1 : -1);
    const explosion = category === 'foundation' ? [0, -.04, 0] : category === 'wheels' ? [side * 1.3, .06, 0] :
      [center.x * .65, .45 + Math.max(0, center.y) * .6, center.z * .42];
    this.parts.push({ group, key, category, center: center.clone(), start, end, rotation,
      entry: entryOffset(category, center.toArray(), key, this.isMobile), explosion });
  }

  addIllustrativeSupport() {
    const group = new THREE.Group(); group.name = 'Illustrative_support';
    const mat = new THREE.MeshStandardMaterial({ color: 0x15191e, metalness: .4, roughness: .6 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.55, .075, 3.55), mat); base.position.y = .18;
    const left = new THREE.Mesh(new THREE.BoxGeometry(.08, .14, 3.3), mat); left.position.set(-.73, .25, 0);
    const right = left.clone(); right.position.x = .73;
    group.add(base, left, right); group.visible = false;
    for (const mesh of group.children) { mesh.castShadow = true; mesh.receiveShadow = true; }
    this.carRoot.add(group); this.addPart(group, 'foundation', new THREE.Vector3(), group.name);
  }

  setProgress(value) {
    this.progress = this.reduced ? 1 : Math.min(1, Math.max(0, value));
    if (this.progress < .94 && this.inspect) this.setInspect(false);
    if (this.progress < .94 && this.explodeTarget) this.setExploded(false);
    this.applyProgress(); this.invalidate();
  }
  applyProgress() {
    for (const part of this.parts) {
      const pose = partPose(this.progress, part.start, part.end, part.entry, part.rotation, this.exploded, part.explosion);
      part.group.visible = pose.visible;
      part.group.position.copy(part.center).add(point.fromArray(pose.offset));
      part.group.rotation.set(...pose.rotation);
    }
    const finish = interval(this.progress, .925, 1);
    for (const material of this.lightMaterials) material.emissiveIntensity = this.lightsOn ? finish * 3.2 : 0;
    this.ring.material.uniforms.uProgress.value = finish;
    this.contact.material.uniforms.uOpacity.value = interval(this.progress, .12, .88) * .7 * (1 - this.exploded * .3);
    if (!this.inspect) this.updateCamera();
  }
  updateCamera() {
    const pose = cameraPose(this.progress, this.camera.aspect, this.exploded);
    this.camera.position.fromArray(pose.position); this.camera.fov = pose.fov;
    this.controls.target.fromArray(pose.target);
    this.camera.lookAt(this.controls.target);
    this.camera.setViewOffset(this.width, this.height, pose.offsetX * this.width, pose.offsetY * this.height, this.width, this.height);
    this.camera.updateProjectionMatrix();
  }
  setFinish(id) {
    const finish = FINISHES.find((candidate) => candidate.id === id);
    if (!finish) return;
    this.finish = finish;
    for (const material of this.paintMaterials) material.color.set(finish.color);
    this.invalidate();
  }
  setLights(on) { this.lightsOn = Boolean(on); this.applyProgress(); this.invalidate(); }
  setExploded(on) {
    this.explodeTarget = on && this.progress >= .94 ? 1 : 0;
    if (this.reduced) this.exploded = this.explodeTarget;
    this.invalidate();
  }
  setReduced(reduced) {
    this.reduced = reduced;
    if (reduced) { this.progress = 1; this.exploded = this.explodeTarget; }
    this.applyProgress(); this.invalidate();
  }
  setInspect(on) {
    this.inspect = Boolean(on && this.ready && this.progress >= .94);
    this.controls.enabled = this.inspect;
    if (this.inspect) {
      this.controls.update();
      this.renderer.domElement.focus({ preventScroll: true });
    } else this.updateCamera();
    this.invalidate();
    return this.inspect;
  }
  onKey(event) {
    if (event.key === 'Escape' && this.inspect) { this.callbacks.onExitInspect(); return; }
    if (!this.inspect || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') this.updateCamera();
    else {
      const delta = this.camera.position.clone().sub(this.controls.target);
      const spherical = new THREE.Spherical().setFromVector3(delta);
      if (event.key === 'ArrowLeft') spherical.theta -= .12;
      if (event.key === 'ArrowRight') spherical.theta += .12;
      if (event.key === 'ArrowUp') spherical.radius = Math.max(this.controls.minDistance, spherical.radius * .93);
      if (event.key === 'ArrowDown') spherical.radius = Math.min(this.controls.maxDistance, spherical.radius * 1.07);
      this.camera.position.copy(this.controls.target).add(delta.setFromSpherical(spherical));
    }
    this.controls.update(); this.invalidate();
  }
  resize() {
    if (this.destroyed) return;
    this.width = Math.max(1, this.host.clientWidth); this.height = Math.max(1, this.host.clientHeight);
    this.isMobile = this.width < 760;
    this.camera.aspect = this.width / this.height;
    this.renderer.setSize(this.width, this.height, false);
    for (const part of this.parts) part.entry = entryOffset(part.category, part.center.toArray(), part.key, this.isMobile);
    this.applyProgress(); this.invalidate();
  }
  invalidate() {
    if (this.destroyed || this.requestId || document.hidden) return;
    this.requestId = requestAnimationFrame((time) => this.draw(time));
  }
  draw(time) {
    this.requestId = 0;
    if (this.destroyed || document.hidden) return;
    const delta = Math.min(.05, Math.max(.001, (time - (this.lastTime || time - 16)) / 1000)); this.lastTime = time;
    let settling = false;
    if (Math.abs(this.exploded - this.explodeTarget) > .001) {
      this.exploded = this.reduced ? this.explodeTarget : this.exploded + (this.explodeTarget - this.exploded) * (1 - Math.exp(-delta * 8));
      this.applyProgress(); settling = true;
    } else if (this.exploded !== this.explodeTarget) { this.exploded = this.explodeTarget; this.applyProgress(); }
    const orbitChanged = this.inspect ? this.controls.update() : false;
    this.renderer.render(this.scene, this.camera);
    if (settling || orbitChanged) this.invalidate();
  }
  getState() {
    return { ready: this.ready, progress: this.progress, parts: this.parts.length,
      visibleParts: this.parts.filter((part) => part.group.visible).length,
      assembledParts: this.parts.filter((part) => this.progress >= part.end).length,
      inspect: this.inspect, exploded: this.exploded, finish: this.finish.id, lightsOn: this.lightsOn, camera: this.camera.position.toArray(),
      drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles };
  }
  disposeLoaded(root) {
    const textures = new Set();
    root.traverse((node) => {
      node.geometry?.dispose();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) if (material) {
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
        material.dispose();
      }
    });
    textures.forEach((texture) => { texture.source?.data?.close?.(); texture.dispose(); });
  }
  dispose() {
    if (this.destroyed) return;
    this.destroyed = true; this.ready = false; this.abort.abort(); cancelAnimationFrame(this.requestId);
    this.resizeObserver?.disconnect(); this.controls?.dispose();
    const geometries = new Set(), materials = new Set();
    this.scene.traverse((node) => {
      if (node.geometry) geometries.add(node.geometry);
      if (node.material) (Array.isArray(node.material) ? node.material : [node.material]).forEach((material) => materials.add(material));
    });
    geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose());
    this.textures.forEach((texture) => { texture.source?.data?.close?.(); texture.dispose(); });
    this.resources.forEach((resource) => resource.dispose());
    this.renderer.dispose(); this.renderer.domElement.remove();
    this.parts.length = 0;
  }
}
