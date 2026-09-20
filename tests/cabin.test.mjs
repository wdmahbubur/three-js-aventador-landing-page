import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { indexIslands, subsetGeometry, doorPanelSide } from '../src/lib/doors.mjs';
import { approach, lookDirection, cabinFov, CABIN, ease } from '../src/lib/cabin-math.mjs';
test('panel seams are not welded merely because vertex positions coincide', () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,1,0],3));
  g.setIndex([0,1,2,3,4,5]); assert.equal(indexIslands(g).length,2);
});
test('indexed triangles sharing vertices remain one complete panel', () => { const g = new THREE.PlaneGeometry(); assert.equal(indexIslands(g).length,1); });
test('extraction preserves vertex positions, UVs and normals', () => {
  const g = new THREE.PlaneGeometry(2,2), indices=[g.index.getX(0),g.index.getX(1),g.index.getX(2)];
  const part=subsetGeometry(g,indices);assert.equal(part.index.count,3);
  for(let i=0;i<3;i++) for(const n of ['position','normal','uv']) {
    assert.equal(part.attributes[n].getX(i),g.attributes[n].getX(indices[i]));
    assert.equal(part.attributes[n].getY(i),g.attributes[n].getY(indices[i]));
  }
});
test('door-panel matching excludes the hood, roof and rear fenders', () => {
  const b=new THREE.Box3(new THREE.Vector3(.833,.175,-.524),new THREE.Vector3(1.10,.963,1.007));
  assert.equal(doorPanelSide(b),1);b.min.x=-1.10;b.max.x=-.833;assert.equal(doorPanelSide(b),-1);
  b.min.z=-2.475;assert.equal(doorPanelSide(b),0);b.min.z=-.524;b.max.y=1.235;assert.equal(doorPanelSide(b),0);
});
test('opening and closing finish exactly at their targets', () => { for(const target of [0,1]) {let n=1-target;for(let i=0;i<200;i++)n=approach(n,target,1/60);assert.equal(n,target);} });
test('door animation is monotone and cannot overshoot', () => { let n=0;for(let i=0;i<100;i++){const next=approach(n,1,.05);assert.ok(next>=n&&next<=1);n=next;} });
test('reduced motion applies the target immediately',()=>assert.equal(approach(0,1,.016,true),1));
test('look vectors are normalized and finite over the full head range',()=>{ for(const y of [-9,-2.6,0,2.6,9])for(const p of [-9,-.85,0,.55,9])assert.ok(Math.abs(Math.hypot(...lookDirection(y,p))-1)<1e-12); });
test('default seated view faces forward and slightly down toward instruments',()=>{ const d=lookDirection(0,CABIN.pitch);assert.equal(d[0],0);assert.ok(d[1]<0&&d[2]>.9); });
test('first person field of view stays bounded on portrait and landscape',()=>{ assert.equal(cabinFov(.46),78);assert.equal(cabinFov(1.6),70);assert.ok(CABIN.near>0&&CABIN.near<.02); });
test('camera path easing preserves endpoints without overshoot',()=>{ assert.equal(ease(-1),0);assert.equal(ease(2),1);assert.equal(ease(.5),.5); });
