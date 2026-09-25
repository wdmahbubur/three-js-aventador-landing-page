import * as THREE from 'three';
import { AssemblyEngine as CabinEngine } from './cabin-renderer.mjs';
import { MaterialConfigurator } from './material-configurator.mjs';
import { HotspotProjector } from './hotspots.mjs';
import { DEFAULT_CONFIGURATION, normalizeConfiguration, validConfigOption } from './configuration.mjs';
import { DETAIL_CAMERAS, isDetail } from './details.mjs';

/** Materials and guided detail views extend, rather than replace, the existing showroom. */
export class AssemblyEngine extends CabinEngine {
  constructor(host, options = {}) {
    super(host, options);
    this.configuration = DEFAULT_CONFIGURATION;
    this.detailId = null; this.detailFlight = null; this.hotspotElements = []; this.hotspotsEnabled = false;
    this.onDetailState = options.onDetailState || (() => {});
    this.renderer.domElement.addEventListener('pointerdown', () => {
      // A user's drag takes priority over a guided camera movement.
      if (this.detailFlight) { this.detailFlight = null; this.inspect = true; this.controls.enabled = true; this.controls.minDistance = .65; this.controls.update(); this.invalidate(); }
    }, { signal: this.abort.signal });
  }
  prepareModel(source) {
    super.prepareModel(source);
    this.materialConfigurator = new MaterialConfigurator(this.parts);
    this.materialConfigurator.apply(this.configuration || DEFAULT_CONFIGURATION);
    this.hotspotProjector = new HotspotProjector(this.parts, this.doorRig, this.host);
    this.hotspotProjector.bind(this.hotspotElements || []);
  }
  getConfigurationCapabilities() { return this.materialConfigurator?.capabilities() || {}; }
  setConfiguration(input) {
    this.configuration = normalizeConfiguration(input);
    super.setFinish(this.configuration.paint);
    this.materialConfigurator?.apply(this.configuration);
    this.invalidate();
  }
  setFinish(id) {
    if (!validConfigOption('paint', id)) return;
    this.setConfiguration({ ...(this.configuration || DEFAULT_CONFIGURATION), paint: id });
  }
  bindHotspots(elements) { this.hotspotElements = elements; this.hotspotProjector?.bind(elements); }
  setHotspotsEnabled(on) {
    if (this.hotspotsEnabled === Boolean(on)) return;
    this.hotspotsEnabled = Boolean(on); this.hotspotProjector?.setEnabled(on); this.invalidate();
  }
  focusDetail(id) {
    if (!this.ready || !isDetail(id) || this.progress < .965 || this.cabinMode !== 'exterior' || this.exploded > .002) return false;
    this.controls.enabled = false;
    // Flush any orbit damping before taking ownership of the camera.
    const damping = this.controls.enableDamping; this.controls.enableDamping = false; this.controls.update(); this.controls.enableDamping = damping;
    this.inspect = false;
    const spec = DETAIL_CAMERAS[id];
    const target = new THREE.Vector3(...spec.target), position = new THREE.Vector3(...spec.position);
    const fit = Math.max(1, .8 / Math.max(.25, this.camera.aspect));
    position.sub(target).multiplyScalar(fit).add(target);
    this.detailId = id;
    this.detailFlight = { start: this.camera.position.clone(), end: position, startTarget: this.controls.target.clone(), target,
      fromFov: this.camera.fov, fov: spec.fov, time: 0, last: undefined };
    if (id === 'cockpit') this.setDoors(true);
    this.onDetailState?.(id);
    if (this.reduced) this.finishDetailFlight();
    this.invalidate(); return true;
  }
  finishDetailFlight() {
    if (!this.detailFlight) return;
    const flight = this.detailFlight;
    this.camera.position.copy(flight.end); this.controls.target.copy(flight.target); this.camera.fov = flight.fov;
    this.camera.clearViewOffset(); this.camera.lookAt(this.controls.target); this.camera.updateProjectionMatrix();
    this.detailFlight = null; this.inspect = true; this.controls.enabled = true; this.controls.minDistance = .65;
    this.controls.update(); this.invalidate();
  }
  clearDetail(restore = true) {
    const hadDetail = Boolean(this.detailId);
    this.detailId = null; this.detailFlight = null;
    if (hadDetail) {
      this.controls.enabled = false; this.inspect = false; this.controls.minDistance = 5;
      if (restore) super.updateCamera();
      this.onDetailState?.(null); this.invalidate();
    }
  }
  updateCamera() {
    if (this.detailId && this.cabinMode === 'exterior' && this.progress >= .965) {
      this.camera.near = .05;
      this.camera.clearViewOffset();
      if (this.detailFlight) {
        const f = this.detailFlight, p = Math.min(1, f.time / 1.15), t = p * p * (3 - 2 * p);
        this.camera.position.lerpVectors(f.start, f.end, t); this.controls.target.lerpVectors(f.startTarget, f.target, t);
        this.camera.fov = THREE.MathUtils.lerp(f.fromFov, f.fov, t); this.camera.lookAt(this.controls.target);
      }
      this.camera.updateProjectionMatrix(); return;
    }
    super.updateCamera();
  }
  setInspect(on) { this.clearDetail(true); return super.setInspect(on); }
  setInterior(inside) { this.clearDetail(false); return super.setInterior(inside); }
  resetCabin(closeDoors = true) { this.clearDetail(false); super.resetCabin(closeDoors); }
  setExploded(on) { if (on) this.clearDetail(true); super.setExploded(on); }
  setProgress(value) { if (value < .965) this.clearDetail(false); super.setProgress(value); }
  setReduced(on) { super.setReduced(on); if (on && this.detailFlight) this.finishDetailFlight(); }
  resize() {
    super.resize();
    if (this.detailId && this.detailFlight && this.ready) this.focusDetail(this.detailId);
  }
  draw(time) {
    if (this.detailFlight && this.active !== false && !document.hidden && !this.destroyed) {
      const f = this.detailFlight;
      f.time += Math.min(.1, Math.max(.001, (time - (f.last || time - 16)) / 1000)); f.last = time;
      this.updateCamera();
      if (f.time >= 1.15) this.finishDetailFlight();
    }
    super.draw(time);
    if (this.destroyed || this.active === false || document.hidden) { if (this.detailFlight) this.detailFlight.last = undefined; return; }
    this.hotspotProjector?.setEnabled(this.hotspotsEnabled && this.progress >= .965 && this.exploded < .002 && this.cabinMode === 'exterior');
    this.hotspotProjector?.update(this.camera, this.carRoot);
    if (this.detailFlight) this.invalidate();
  }
  getState() {
    return { ...super.getState(), configuration: this.configuration, materials: this.materialConfigurator?.getState() || null,
      detail: this.detailId, detailMoving: Boolean(this.detailFlight), hotspots: this.hotspotProjector?.last || [] };
  }
  dispose() {
    if (this.destroyed) return;
    this.hotspotProjector?.dispose(); this.materialConfigurator?.dispose(); this.detailFlight = null;
    super.dispose();
  }
}
