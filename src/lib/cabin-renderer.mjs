import * as THREE from 'three';
import { AssemblyEngine as PremiumEngine } from './premium-renderer.mjs';
import { DoorRig } from './doors.mjs';
import { CABIN, approach, cabinFov, clamp, ease, lookDirection } from './cabin-math.mjs';

/** A reversible, seated first-person tour. No pointer lock or unbounded free flight. */
export class AssemblyEngine extends PremiumEngine {
  constructor(host, options = {}) {
    super(host, options);
    this.cabinMode = 'exterior'; this.travel = 0;
    this.doorValue = 0; this.doorTarget = 0;
    this.lookYaw = this.targetYaw = 0; this.lookPitch = this.targetPitch = CABIN.pitch;
    this.onCabinState = options.onCabinState || (() => {});
    const canvas = this.renderer.domElement, signal = this.abort.signal;
    canvas.addEventListener('pointerdown', event => {
      if (this.cabinMode !== 'inside' || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault(); this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId); canvas.focus({ preventScroll: true });
    }, { signal });
    canvas.addEventListener('pointermove', event => {
      if (!this.drag || this.drag.id !== event.pointerId || this.cabinMode !== 'inside') return;
      event.preventDefault();
      this.targetYaw = clamp(this.targetYaw + (event.clientX - this.drag.x) * .004, -CABIN.maxYaw, CABIN.maxYaw);
      this.targetPitch = clamp(this.targetPitch + (event.clientY - this.drag.y) * .003, CABIN.minPitch, CABIN.maxPitch);
      this.drag.x = event.clientX; this.drag.y = event.clientY; this.invalidate();
    }, { signal });
    const release = () => { this.drag = null; };
    canvas.addEventListener('pointerup', release, { signal });
    canvas.addEventListener('pointercancel', release, { signal });
    canvas.addEventListener('lostpointercapture', release, { signal });
    canvas.addEventListener('wheel', event => {
      if (this.cabinMode !== 'inside') return;
      event.preventDefault(); this.fovAdjustment = clamp((this.fovAdjustment || 0) + event.deltaY * .015, -12, 10);
      this.updateCamera(); this.invalidate();
    }, { signal, passive: false });
  }
  prepareModel(source) {
    super.prepareModel(source);
    try { this.doorRig = new DoorRig(this.parts); }
    catch (error) { this.cabinError = error.message; console.warn('[Cabin]', error.message); }
    this.glassSettings = [];
    const seen = new Set();
    this.carRoot.traverse(object => {
      const material = object.material;
      if (!material || seen.has(material)) return;
      seen.add(material);
      if (material.name === 'Windows') this.glassSettings.push({ material, opacity: material.opacity, env: material.envMapIntensity });
    });
    this.cabinFill = new THREE.PointLight(0xffead8, 0, 2.8, 2);
    this.cabinFill.position.set(.1, 1.13, .26); this.scene.add(this.cabinFill);
    this.exteriorExposure = this.renderer.toneMappingExposure;
    this.exteriorEnvironment = this.scene.environmentIntensity;
    this.cameraHelper = new THREE.Object3D();
    this.emitCabinState();
  }
  emitCabinState() {
    this.onCabinState?.({ mode: this.cabinMode || 'exterior', doorsOpen: this.doorTarget === 1,
      available: Boolean(this.doorRig), error: this.cabinError || null });
  }
  setDoors(open) {
    if (!this.ready || !this.doorRig || this.progress < .965 || this.explodeTarget || this.exploded > .01 ||
      ['entering', 'exiting'].includes(this.cabinMode)) return false;
    this.doorTarget = open ? 1 : 0; this.cabinLastTime = undefined;
    if (this.reduced) { this.doorValue = this.doorTarget; this.applyProgress(); }
    this.emitCabinState(); this.invalidate(); return true;
  }
  setInterior(inside) {
    if (!this.ready || !this.doorRig || this.progress < .965) return false;
    if (inside) {
      if (this.cabinMode !== 'exterior') return false;
      super.setExploded(false);
      this.controls.enabled = false; this.inspect = false;
      this.savedExterior = { position: this.camera.position.clone(), quaternion: this.camera.quaternion.clone(), fov: this.camera.fov };
      this.entryPath = new THREE.CatmullRomCurve3([
        this.camera.position.clone(), new THREE.Vector3(2.6, 1.42, 1.35),
        new THREE.Vector3(1.6, 1.13, -.08), new THREE.Vector3(.98, 1.045, -.075), new THREE.Vector3(...CABIN.eye)
      ], false, 'centripetal');
      this.lookYaw = this.targetYaw = 0; this.lookPitch = this.targetPitch = CABIN.pitch;
      this.fovAdjustment = 0; this.travel = 0; this.cabinMode = 'entering';
    } else {
      if (!['entering', 'inside'].includes(this.cabinMode)) return false;
      this.exitQuaternion = this.camera.quaternion.clone(); this.exitStart = this.travel;
      this.cabinMode = 'exiting'; this.drag = null;
    }
    this.doorTarget = 1; this.cabinLastTime = undefined;
    if (this.reduced) {
      this.doorValue = 1; this.travel = inside ? 1 : 0;
      this.cabinMode = inside ? 'inside' : 'exterior';
      this.applyProgress();
    }
    this.emitCabinState(); this.renderer.domElement.focus({ preventScroll: true }); this.invalidate(); return true;
  }
  setCabinView(view) {
    if (this.cabinMode !== 'inside') return;
    const angles = { dashboard: [0, CABIN.pitch], left: [1.35, -.16], passenger: [-1.35, -.25] }[view];
    if (!angles) return;
    [this.targetYaw, this.targetPitch] = angles; this.fovAdjustment = 0; this.invalidate();
  }
  applyCabinLight(weight) {
    if (!this.cabinFill) return;
    this.cabinFill.intensity = 1.5 * weight;
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(this.exteriorExposure, 1.05, weight);
    this.scene.environmentIntensity = THREE.MathUtils.lerp(this.exteriorEnvironment, .85, weight);
    for (const { material, opacity, env } of this.glassSettings) {
      material.opacity = THREE.MathUtils.lerp(opacity, .14, weight);
      material.envMapIntensity = THREE.MathUtils.lerp(env, .04, weight);
    }
  }
  updateCamera() {
    if (!this.cabinMode || this.cabinMode === 'exterior' || !this.entryPath) {
      if (this.camera) this.camera.near = .05;
      this.applyCabinLight(0); super.updateCamera(); return;
    }
    const t = ease(this.travel);
    this.camera.near = CABIN.near;
    this.camera.clearViewOffset();
    if (this.cabinMode === 'inside') {
      this.camera.position.fromArray(CABIN.eye);
      const direction = new THREE.Vector3(...lookDirection(this.lookYaw, this.lookPitch));
      this.camera.lookAt(direction.add(this.camera.position));
      this.camera.fov = cabinFov(this.camera.aspect) + (this.fovAdjustment || 0);
      this.applyCabinLight(1);
    } else {
      this.entryPath.getPoint(t, this.camera.position);
      this.cameraHelper.position.copy(this.camera.position);
      this.cameraHelper.lookAt(new THREE.Vector3(.445, .80, .59));
      const look = new THREE.Matrix4().lookAt(this.camera.position, new THREE.Vector3(.445, .80, .59), this.camera.up);
      const towardCabin = new THREE.Quaternion().setFromRotationMatrix(look);
      const eye = new THREE.Vector3(...CABIN.eye), dir = new THREE.Vector3(...lookDirection(0, CABIN.pitch));
      const seated = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, eye.clone().add(dir), this.camera.up));
      const q = this.savedExterior.quaternion.clone().slerp(towardCabin, ease(t / .3));
      q.slerp(seated, ease((t - .65) / .35));
      if (this.cabinMode === 'exiting' && this.exitStart > .01) {
        const out = ease((this.exitStart - this.travel) / .2);
        q.copy(this.exitQuaternion).slerp(q.clone().copy(this.savedExterior.quaternion).slerp(towardCabin, ease(t / .3)).slerp(seated, ease((t - .65) / .35)), out);
      }
      this.camera.quaternion.copy(q);
      this.camera.fov = THREE.MathUtils.lerp(this.savedExterior.fov, cabinFov(this.camera.aspect), ease(t));
      this.applyCabinLight(ease((t - .45) / .45));
    }
    this.camera.updateProjectionMatrix();
  }
  applyProgress() {
    super.applyProgress();
    if (this.doorRig) this.doorRig.setAmount(this.progress >= .965 && this.exploded < .002 ? this.doorValue || 0 : 0);
  }
  resetCabin(closeDoors = true) {
    if (!this.cabinMode) return;
    this.cabinMode = 'exterior'; this.travel = 0; this.drag = null;
    if (closeDoors) this.doorTarget = this.doorValue = 0;
    this.doorRig?.setAmount(this.doorValue);
    this.updateCamera(); this.emitCabinState();
    this.renderer.shadowMap.needsUpdate = true; this.invalidate();
  }
  setProgress(value) {
    if (value < .965 && (this.cabinMode !== 'exterior' || this.doorValue || this.doorTarget)) this.resetCabin();
    super.setProgress(value);
  }
  setExploded(on) { if (on) this.resetCabin(); super.setExploded(on); }
  setInspect(on) { if (on && this.cabinMode !== 'exterior') this.resetCabin(false); return super.setInspect(on); }
  setReduced(reduced) {
    super.setReduced(reduced);
    if (reduced && this.cabinMode) {
      this.doorValue = this.doorTarget;
      if (this.cabinMode === 'entering') { this.travel = 1; this.cabinMode = 'inside'; }
      if (this.cabinMode === 'exiting') { this.travel = 0; this.cabinMode = 'exterior'; }
      this.applyProgress(); this.emitCabinState();
    }
  }
  onKey(event) {
    if (this.cabinMode === 'exterior' || !this.cabinMode) return super.onKey(event);
    if (event.key === 'Escape') { event.preventDefault(); this.setInterior(false); return; }
    if (this.cabinMode !== 'inside') return;
    const key = event.key.toLowerCase();
    if (!['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's', 'home'].includes(key)) return;
    event.preventDefault();
    if (key === 'home') this.setCabinView('dashboard');
    if (['arrowleft', 'a'].includes(key)) this.targetYaw += .12;
    if (['arrowright', 'd'].includes(key)) this.targetYaw -= .12;
    if (['arrowup', 'w'].includes(key)) this.targetPitch += .08;
    if (['arrowdown', 's'].includes(key)) this.targetPitch -= .08;
    this.targetYaw = clamp(this.targetYaw, -CABIN.maxYaw, CABIN.maxYaw);
    this.targetPitch = clamp(this.targetPitch, CABIN.minPitch, CABIN.maxPitch); this.invalidate();
  }
  draw(time) {
    if (this.destroyed || this.active === false || document.hidden) { this.cabinLastTime = undefined; return super.draw(time); }
    const dt = Math.min(.5, Math.max(.001, (time - (this.cabinLastTime || time - 16)) / 1000)); this.cabinLastTime = time;
    const previousDoor = this.doorValue;
    this.doorValue = approach(this.doorValue || 0, this.doorTarget || 0, dt, this.reduced);
    if (previousDoor !== this.doorValue) { this.doorRig?.setAmount(this.exploded < .002 ? this.doorValue : 0); this.renderer.shadowMap.needsUpdate = true; }
    if (['entering', 'exiting'].includes(this.cabinMode) && this.doorValue >= .995 && this.exploded < .002) {
      this.travel = clamp(this.travel + (this.cabinMode === 'entering' ? 1 : -1) * dt / 2.9, 0, 1);
      if (this.travel === 1 && this.cabinMode === 'entering') { this.cabinMode = 'inside'; this.emitCabinState(); }
      if (this.travel === 0 && this.cabinMode === 'exiting') { this.cabinMode = 'exterior'; this.emitCabinState(); }
    }
    if (this.cabinMode === 'inside') {
      this.lookYaw = approach(this.lookYaw, this.targetYaw, dt, this.reduced);
      this.lookPitch = approach(this.lookPitch, this.targetPitch, dt, this.reduced);
    }
    if (this.cabinMode !== 'exterior' || this.travel === 0) {
      if (!this.inspect) this.updateCamera();
    }
    super.draw(time);
    if (this.doorValue !== this.doorTarget || ['entering', 'exiting'].includes(this.cabinMode) ||
      (this.cabinMode === 'inside' && (this.lookYaw !== this.targetYaw || this.lookPitch !== this.targetPitch))) this.invalidate();
  }
  getState() {
    return { ...super.getState(), cabin: { mode: this.cabinMode || 'exterior', travel: this.travel || 0,
      available: Boolean(this.doorRig), yaw: this.lookYaw || 0, pitch: this.lookPitch ?? CABIN.pitch,
      doorsOpen: this.doorTarget === 1, door: this.doorRig?.getState() || null, near: this.camera.near, fov: this.camera.fov,
      cameraPosition: this.camera.position.toArray(), cameraDirection: this.camera.getWorldDirection(new THREE.Vector3()).toArray() } };
  }
  dispose() {
    if (this.destroyed) return;
    this.doorRig?.dispose(); this.doorRig = null;
    this.cabinMode = 'exterior'; this.emitCabinState();
    super.dispose();
  }
}
