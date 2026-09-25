import { CONFIG_OPTIONS, DEFAULT_CONFIGURATION, normalizeConfiguration, materialSlot } from './configuration.mjs';

/** Clone shared materials only at the configurable boundary. Never recolour logos/glass/tyres. */
export class MaterialConfigurator {
  constructor(parts) {
    this.records = []; this.slots = new Map(); this.clones = new Set(); this.configuration = DEFAULT_CONFIGURATION;
    const cache = new Map();
    for (const part of parts) part.group.traverse(mesh => {
      if (!mesh.isMesh || !mesh.material) return;
      const source = mesh.material, originals = Array.isArray(source) ? source : [source];
      let changed = false;
      const materials = originals.map(original => {
        const slot = materialSlot(part.key, original.name, mesh.name);
        if (!slot) return original;
        if (!cache.has(original)) cache.set(original, new Map());
        const bySlot = cache.get(original);
        if (!bySlot.has(slot)) {
          // Body is intentionally shared with both moving doors and mirrors.
          const material = slot === 'paint' ? original : original.clone();
          if (material !== original) this.clones.add(material);
          bySlot.set(slot, material);
          if (!this.slots.has(slot)) this.slots.set(slot, []);
          this.slots.get(slot).push({ material, baseColor: original.color.clone(), baseRoughness: original.roughness, baseMetalness: original.metalness });
        }
        const material = bySlot.get(slot); changed ||= material !== original; return material;
      });
      if (changed) { this.records.push({ mesh, source }); mesh.material = Array.isArray(source) ? materials : materials[0]; }
    });
    this.apply(DEFAULT_CONFIGURATION);
  }
  capabilities() {
    const result = {};
    for (const key of Object.keys(DEFAULT_CONFIGURATION)) result[key] = (this.slots.get(key === 'paintFinish' ? 'paint' : key)?.length || 0) > 0;
    return result;
  }
  apply(input) {
    this.configuration = normalizeConfiguration(input);
    for (const [slot, bindings] of this.slots) {
      const option = CONFIG_OPTIONS[slot].find(o => o.id === this.configuration[slot]);
      for (const { material, baseColor, baseRoughness, baseMetalness } of bindings) {
        material.color.copy(baseColor); material.roughness = baseRoughness; material.metalness = baseMetalness;
        if (option?.color && option.id !== 'original') material.color.set(option.color);
        if (slot === 'paint') {
          const matte = this.configuration.paintFinish === 'matte';
          material.roughness = matte ? .69 : .27; material.clearcoat = matte ? .06 : .72; material.clearcoatRoughness = matte ? .65 : .16;
        }
        if (slot === 'carbon') { material.roughness = this.configuration.carbon === 'polished' ? .2 : .43; }
        if (slot === 'wheels') { material.metalness = .88; material.roughness = .28; }
        if (slot === 'calipers') { material.metalness = .3; material.roughness = .38; }
      }
    }
  }
  getState() {
    const bindings = {};
    for (const [slot, items] of this.slots) bindings[slot] = items.map(({material}) => ({ color: '#' + material.color.getHexString(), roughness: material.roughness, metalness: material.metalness, clearcoat: material.clearcoat ?? null }));
    return { selection: this.configuration, capabilities: this.capabilities(), bindings, clonedMaterials: this.clones.size };
  }
  dispose() {
    for (const { mesh, source } of this.records) mesh.material = source;
    this.clones.forEach(material => material.dispose()); this.clones.clear(); this.records.length = 0;
  }
}
