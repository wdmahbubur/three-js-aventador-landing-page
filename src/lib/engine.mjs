import { AssemblyEngine as BaseAssemblyEngine } from './assembly-engine.mjs';
import { HeadlightSystem } from './headlights.mjs';

/** Preserve the existing assembly renderer; add an independently disposable light rig. */
export class AssemblyEngine extends BaseAssemblyEngine {
  prepareModel(source) {
    super.prepareModel(source);
    this.headlightSystem?.dispose();
    this.headlightSystem = new HeadlightSystem(this.carRoot, this.parts);
  }

  applyProgress() {
    super.applyProgress();
    // Base construction/resize can call this before the asynchronous model is ready.
    this.headlightSystem?.update(this.progress, this.exploded, this.lightsOn, this.isMobile);
  }

  getState() {
    return { ...super.getState(), headlights: this.headlightSystem?.getState() ?? null };
  }

  dispose() {
    if (this.destroyed) return;
    this.headlightSystem?.dispose();
    this.headlightSystem = null;
    super.dispose();
  }
}
