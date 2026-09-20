import * as THREE from 'three';
import { isProjector, resolveHeadlightLayout, headlightTarget, headlightStrength, makeHeadlightCookie } from './headlight-layout.mjs';

/** Two real surface-lighting projectors, plus deliberately subtle atmospheric scattering. */
export class HeadlightSystem {
  constructor(root, parts) {
    this.root = root;
    this.lamps = [];
    this.frontMaterials = new Set();
    this.glassCasters = [];
    this.disposed = false;
    this.strength = 0;
    this.point = new THREE.Vector3();
    root.updateWorldMatrix(true, true);
    const inverseRoot = root.matrixWorld.clone().invert();
    const samples = [], rear = new THREE.Box3();
    for (const part of parts) {
      part.group.traverse((mesh) => {
        if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const label = [mesh.name, ...materials.map((m) => m.name)].join(' ');
        if (/tail[_ .-]?light|brake_light/i.test(label)) rear.expandByObject(mesh);
        if (!isProjector(label)) return;
        const matrix = inverseRoot.clone().multiply(mesh.matrixWorld);
        const positions = mesh.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          this.point.fromBufferAttribute(positions, i).applyMatrix4(matrix);
          samples.push({ position: this.point.toArray(), owner: part });
        }
        materials.forEach((material) => {
          if (material.emissive && isProjector(material.name)) this.frontMaterials.add(material);
        });
      });
    }
    const rearCentre = rear.isEmpty() ? [0, 0, 0] : rear.getCenter(this.point).applyMatrix4(inverseRoot).toArray();
    const layout = resolveHeadlightLayout(samples, rearCentre);
    this.forward = layout.forward;
    this.right = layout.right;
    this.readyAt = Math.max(.947, ...layout.lamps.map((lamp) => lamp.owner.end));
    this.cookie = new THREE.DataTexture(makeHeadlightCookie(), 128, 128, THREE.RGBAFormat);
    this.cookie.name = 'Procedural low-beam cutoff';
    this.cookie.minFilter = this.cookie.magFilter = THREE.LinearFilter;
    this.cookie.generateMipmaps = false;
    this.cookie.needsUpdate = true;
    this.rig = new THREE.Group();
    this.rig.name = 'Forward headlight projectors';
    root.add(this.rig);
    this.beamGeometry = new THREE.CylinderGeometry(1.45, .025, 6.5, 32, 1, true);
    // Cylinder's bottom is the narrow origin; its wide top becomes local +Z.
    this.beamGeometry.rotateX(Math.PI / 2);
    this.beamGeometry.translate(0, 0, 3.25);
    this.beamGeometry.scale(1, .26, 1);

    for (const lamp of layout.lamps) {
      const owner = lamp.owner.group;
      const anchor = new THREE.Object3D();
      anchor.name = `Projector aperture ${lamp.side}`;
      this.point.fromArray(lamp.position).applyMatrix4(root.matrixWorld);
      anchor.position.copy(owner.worldToLocal(this.point));
      owner.add(anchor);
      const light = new THREE.SpotLight(0xfff8ee, 0, 20, THREE.MathUtils.degToRad(25), .65, 2);
      light.name = lamp.side < 0 ? 'Left low beam' : 'Right low beam';
      light.map = this.cookie;
      light.castShadow = true;
      light.shadow.mapSize.set(512, 512);
      light.shadow.camera.near = .12;
      light.shadow.camera.far = 20;
      light.shadow.bias = -.00015;
      light.shadow.normalBias = .012;
      const target = new THREE.Object3D();
      target.name = `${light.name} road target`;
      light.target = target;
      const beam = new THREE.Mesh(this.beamGeometry, this.makeBeamMaterial());
      beam.name = `${light.name} atmospheric scattering`;
      beam.visible = false;
      beam.renderOrder = 3;
      this.rig.add(light, target, beam);
      this.lamps.push({ light, target, beam, anchor, side: lamp.side });
    }
    // The transparent lens should not become an opaque shadow barrier in front of its bulb.
    for (const part of parts) part.group.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const names = [mesh.name, ...materials.map((m) => m.name)].join(' ');
      if (/headlight|daylight/i.test(names) && /glass/i.test(names)) {
        this.glassCasters.push([mesh, mesh.castShadow]); mesh.castShadow = false;
      }
    });
    this.update(0, 0, false);
  }

  makeBeamMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: {
        uStrength: { value: 0 }, uOriginY: { value: 0 },
        uColor: { value: new THREE.Color(0xfff8ee) }
      },
      vertexShader: `
        varying vec3 vViewPosition;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        varying float vDistance;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vec4 view = viewMatrix * world;
          vWorldPosition = world.xyz;
          vViewPosition = -view.xyz;
          vNormal = normalize(normalMatrix * normal);
          vDistance = position.z / 6.5;
          gl_Position = projectionMatrix * view;
        }`,
      fragmentShader: `
        uniform float uStrength;
        uniform float uOriginY;
        uniform vec3 uColor;
        varying vec3 vViewPosition;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        varying float vDistance;
        void main() {
          float along = clamp(vDistance, 0.0, 1.0);
          float rim = pow(abs(dot(normalize(vNormal), normalize(vViewPosition))), 1.1);
          float fade = smoothstep(0.0, 0.035, along) * pow(1.0 - along, 2.0);
          float aboveFloor = smoothstep(-0.024, 0.04, vWorldPosition.y);
          float cutoff = 1.0 - smoothstep(uOriginY + 0.01, uOriginY + 0.13, vWorldPosition.y);
          float alpha = uStrength * rim * fade * aboveFloor * cutoff;
          if (alpha < 0.0001) discard;
          gl_FragColor = vec4(uColor, alpha);
          #include <colorspace_fragment>
        }`
    });
  }

  update(progress, exploded = 0, lightsOn = true, mobile = false) {
    if (this.disposed) return;
    this.strength = headlightStrength(progress, exploded, lightsOn, this.readyAt);
    this.root.updateWorldMatrix(true, true);
    for (const material of this.frontMaterials) {
      material.emissive.set(0xfff8ee);
      material.emissiveIntensity = this.strength * 3.2;
    }
    for (const lamp of this.lamps) {
      lamp.anchor.getWorldPosition(this.point);
      const worldY = this.point.y;
      this.root.worldToLocal(this.point);
      lamp.light.position.copy(this.point);
      lamp.target.position.fromArray(headlightTarget(this.point.toArray(), this.forward, this.right, lamp.side));
      lamp.light.intensity = this.strength * 700;
      // Keep the same two lights in the renderer's program even when off, avoiding toggle recompiles.
      lamp.light.shadow.autoUpdate = this.strength > .0001;
      if (this.strength > .0001) lamp.light.shadow.needsUpdate = true;
      lamp.beam.position.copy(this.point);
      lamp.beam.lookAt(this.root.localToWorld(this.point.copy(lamp.target.position)));
      lamp.beam.visible = this.strength > .0001;
      lamp.beam.material.uniforms.uOriginY.value = worldY;
      lamp.beam.material.uniforms.uStrength.value = this.strength * (mobile ? .024 : .045);
    }
  }

  getState() {
    return {
      count: this.lamps.length, strength: this.strength, forward: [...this.forward],
      positions: this.lamps.map(({ light }) => light.position.toArray()),
      targets: this.lamps.map(({ target }) => target.position.toArray()),
      intensities: this.lamps.map(({ light }) => light.intensity),
      beamVisible: this.lamps.map(({ beam }) => beam.visible)
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const lamp of this.lamps) {
      lamp.anchor.removeFromParent();
      lamp.light.dispose();
      lamp.beam.material.dispose();
    }
    this.glassCasters.forEach(([mesh, value]) => { mesh.castShadow = value; });
    this.beamGeometry.dispose();
    this.cookie.dispose();
    this.rig.removeFromParent();
    this.lamps.length = 0;
    this.frontMaterials.clear();
  }
}
