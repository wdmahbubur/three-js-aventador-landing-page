import * as THREE from 'three';

/** Connected index islands preserve the model's authored hard-edge panel seams.
 * Do not position-weld these: the closed doors share coordinates with the body. */
export function indexIslands(geometry) {
  const position = geometry.getAttribute('position');
  if (!position || !geometry.index) return [];
  const indices = geometry.index.array, parents = new Int32Array(position.count);
  for (let i = 0; i < parents.length; i++) parents[i] = i;
  const find = i => { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; };
  for (let i = 0; i < indices.length; i += 3) {
    parents[find(indices[i + 1])] = find(indices[i]);
    parents[find(indices[i + 2])] = find(indices[i]);
  }
  const islands = new Map();
  for (let i = 0; i < indices.length; i += 3) {
    const id = find(indices[i]);
    if (!islands.has(id)) islands.set(id, []);
    islands.get(id).push(indices[i], indices[i + 1], indices[i + 2]);
  }
  return [...islands.values()];
}

export function subsetGeometry(source, indices) {
  const geometry = new THREE.BufferGeometry(), remap = new Map(), vertices = [], result = [];
  for (const index of indices) {
    if (!remap.has(index)) { remap.set(index, vertices.length); vertices.push(index); }
    result.push(remap.get(index));
  }
  for (const [name, attribute] of Object.entries(source.attributes)) {
    const values = new attribute.array.constructor(vertices.length * attribute.itemSize);
    for (let i = 0; i < vertices.length; i++) {
      const start = vertices[i] * attribute.itemSize;
      values.set(attribute.array.subarray(start, start + attribute.itemSize), i * attribute.itemSize);
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize, attribute.normalized));
  }
  geometry.setIndex(result);
  if (result.length) { geometry.computeBoundingBox(); geometry.computeBoundingSphere(); }
  return geometry;
}

const vector = new THREE.Vector3(), axisX = new THREE.Vector3(1, 0, 0), axisY = new THREE.Vector3(0, 1, 0);
/** Select complete pre-existing panels, not arbitrary cut triangles.
 * Bounds apply to the pinned ALIEEEN Revuelto normalized to 4.95 units long. */
export function doorPanelSide(bounds) {
  const { min, max } = bounds;
  const side = min.x > .80 ? 1 : max.x < -.80 ? -1 : 0;
  return side && min.z > -.54 && min.z < -.50 && max.z > .90 && max.z < 1.02 &&
    min.y > .16 && min.y < .20 && max.y > .95 && max.y < .98 ? side : 0;
}

export class DoorRig {
  constructor(parts) {
    this.records = []; this.pivots = []; this.amount = 0;
    this.counts = { left: 0, right: 0 }; this.destroyed = false;
    const plans = [];
    for (const part of parts) {
      const shell = part.key === 'Hood075';
      const accessories = ['Interior_doors', 'Right&Left_windows', 'Mirrors'].includes(part.key);
      if (!shell && !accessories) continue;
      for (const mesh of [...part.group.children]) {
        if (!mesh.isMesh || (shell && mesh.material.name !== 'Body')) continue;
        const selected = { '-1': [], '1': [] }, retained = [];
        for (const island of indexIslands(mesh.geometry)) {
          const bounds = new THREE.Box3();
          for (const index of island) bounds.expandByPoint(vector.fromBufferAttribute(mesh.geometry.attributes.position, index).add(part.center));
          const side = shell ? doorPanelSide(bounds) : (bounds.min.x > .1 ? 1 : bounds.max.x < -.1 ? -1 : 0);
          if (side) selected[side].push(...island); else retained.push(...island);
        }
        if (selected[-1].length || selected[1].length) plans.push({ part, mesh, shell, selected, retained });
      }
    }
    const shellPlan = plans.find(plan => plan.shell);
    if (!shellPlan || shellPlan.selected[-1].length < 1800 || shellPlan.selected[1].length < 1800) {
      throw new Error('The pinned model door panels could not be separated safely.');
    }
    this.hinges = { '-1': new THREE.Vector3(-.905, .82, .945), '1': new THREE.Vector3(.905, .82, .945) };
    for (const plan of plans) {
      const original = plan.mesh.geometry, visible = plan.mesh.visible;
      const kept = subsetGeometry(original, plan.retained);
      plan.mesh.geometry = kept; plan.mesh.visible = plan.retained.length > 0;
      this.records.push({ mesh: plan.mesh, original, kept, visible });
      for (const side of [-1, 1]) {
        if (!plan.selected[side].length) continue;
        const geometry = subsetGeometry(original, plan.selected[side]);
        const pivot = new THREE.Group(); pivot.name = `Door_${side > 0 ? 'driver' : 'passenger'}_${plan.mesh.name}`;
        pivot.position.copy(this.hinges[side]).sub(plan.part.center);
        const movingMesh = new THREE.Mesh(geometry, plan.mesh.material);
        movingMesh.name = plan.mesh.name + (side > 0 ? '_door_left' : '_door_right');
        movingMesh.position.copy(plan.part.center).sub(this.hinges[side]);
        movingMesh.castShadow = true; movingMesh.receiveShadow = true;
        pivot.add(movingMesh); plan.part.group.add(pivot);
        this.pivots.push({ pivot, side, movingMesh });
        this.counts[side > 0 ? 'left' : 'right'] += plan.selected[side].length / 3;
      }
    }
    this.pitch = new THREE.Quaternion(); this.yaw = new THREE.Quaternion();
  }
  setAmount(amount) {
    this.amount = THREE.MathUtils.clamp(Number.isFinite(amount) ? amount : 0, 0, 1);
    for (const { pivot, side } of this.pivots) {
      this.pitch.setFromAxisAngle(axisX, 1.13 * this.amount);
      this.yaw.setFromAxisAngle(axisY, -.24 * side * this.amount);
      pivot.quaternion.copy(this.yaw).multiply(this.pitch);
    }
  }
  getState() {
    return { amount: this.amount, panels: this.pivots.length, triangles: this.counts,
      leftAngle: this.amount * 1.13, rightAngle: this.amount * 1.13,
      hinges: [this.hinges[1].toArray(), this.hinges[-1].toArray()] };
  }
  dispose() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const { pivot, movingMesh } of this.pivots) { pivot.removeFromParent(); movingMesh.geometry.dispose(); }
    for (const { mesh, original, kept, visible } of this.records) { kept.dispose(); mesh.geometry = original; mesh.visible = visible; }
    this.pivots.length = 0; this.records.length = 0;
  }
}
