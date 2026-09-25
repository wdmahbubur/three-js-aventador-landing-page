import * as THREE from 'three';

/** Project actual model landmarks into one DOM overlay. No React updates per frame. */
export class HotspotProjector {
  constructor(parts, doorRig, host) {
    this.host = host; this.elements = []; this.enabled = false; this.last = [];
    this.ray = new THREE.Raycaster(); this.ndc = new THREE.Vector3(); this.direction = new THREE.Vector3();
    this.point = new THREE.Vector3(); this.cameraPosition = new THREE.Vector3();
    const box = key => new THREE.Box3().setFromObject(parts.find(p => p.key === key).group);
    const lights = box('Headlight'), wheel = box('Wheel_FL'), screen = box('Windshield'), engine = box('Engine');
    const wheelCenter = wheel.getCenter(new THREE.Vector3());
    const door = doorRig?.pivots.find(p => p.side === 1 && p.movingMesh.material.name === 'Body')?.movingMesh;
    const doorPoint = new THREE.Vector3();
    if (door) { door.geometry.computeBoundingBox(); door.geometry.boundingBox.getCenter(doorPoint); doorPoint.x += .045; }
    this.anchors = [
      { id: 'headlights', point: new THREE.Vector3(lights.max.x * .86, lights.max.y - .08, lights.max.z + .05), normal: new THREE.Vector3(0, 0, 1) },
      { id: 'wheels', point: new THREE.Vector3(wheel.max.x + .055, wheelCenter.y, wheelCenter.z), normal: new THREE.Vector3(1, 0, 0) },
      { id: 'doors', point: doorPoint, object: door, normal: new THREE.Vector3(1, 0, 0) },
      { id: 'cockpit', point: new THREE.Vector3(screen.max.x + .1, screen.max.y + .025, .48), normal: new THREE.Vector3(1, .3, .2).normalize() },
      { id: 'engine', point: new THREE.Vector3(0, engine.max.y + .09, engine.getCenter(new THREE.Vector3()).z), normal: new THREE.Vector3(0, 1, 0) }
    ];
    this.meshes = [];
    for (const part of parts) part.group.traverse(mesh => {
      if (!mesh.isMesh || !mesh.geometry?.attributes.position || mesh.material?.isShaderMaterial) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (materials.every(m => m.transparent)) return;
      this.meshes.push(mesh);
    });
  }
  bind(elements) { this.elements = elements; }
  setEnabled(value) {
    this.enabled = Boolean(value);
    if (!this.enabled) this.elements.forEach(el => { el.hidden = true; });
  }
  update(camera, carRoot) {
    if (!this.enabled || !this.elements.length) return;
    carRoot.updateWorldMatrix(true, true); camera.updateWorldMatrix(true, false);
    const width = this.host.clientWidth, height = this.host.clientHeight;
    camera.getWorldPosition(this.cameraPosition);
    const visibleMeshes = this.meshes.filter(mesh => {
      for (let node = mesh; node; node = node.parent) if (!node.visible) return false;
      return true;
    });
    this.last = this.anchors.map(anchor => {
      this.point.copy(anchor.point);
      if (anchor.object) anchor.object.localToWorld(this.point);
      const distance = this.point.distanceTo(this.cameraPosition);
      this.direction.copy(this.cameraPosition).sub(this.point).normalize();
      this.ndc.copy(this.point).project(camera);
      let reason = anchor.normal.dot(this.direction) < .08 ? 'back-facing' :
        this.ndc.z < -1 || this.ndc.z > 1 || Math.abs(this.ndc.x) > .94 || Math.abs(this.ndc.y) > .91 ? 'offscreen' : '';
      if (!reason) {
        this.ray.set(this.cameraPosition, this.direction.negate()); this.ray.near = .04; this.ray.far = Math.max(.04, distance - .09);
        if (this.ray.intersectObjects(visibleMeshes, false).length) reason = 'occluded';
      }
      const x = (this.ndc.x * .5 + .5) * width, y = (-this.ndc.y * .5 + .5) * height;
      const element = this.elements.find(el => el.dataset.hotspot === anchor.id);
      if (element) {
        element.hidden = Boolean(reason);
        if (!reason) element.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
      }
      return { id: anchor.id, visible: !reason, reason, x, y, world: this.point.toArray() };
    });
  }
  dispose() { this.setEnabled(false); this.elements = []; this.meshes = []; }
}
