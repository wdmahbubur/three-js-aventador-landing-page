import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createShowroomStore, INITIAL_STATE, isMode, isFinish, isQuality, modeAtKey } from '../src/lib/showroom/state.ts';

test('server snapshot and first client snapshot are identical', () => {
  const store = createShowroomStore(); assert.equal(store.getSnapshot(), store.getServerSnapshot());
  assert.equal(store.getSnapshot(), INITIAL_STATE);
});
test('state stores are isolated between component instances and SSR requests', () => {
  const a = createShowroomStore(), b = createShowroomStore(); a.patch({ finish: 'arancio' });
  assert.equal(b.getSnapshot().finish, 'rosso'); assert.equal(a.getServerSnapshot().finish, 'rosso');
});
test('cached snapshots do not notify React for unchanged animation samples', () => {
  const s = createShowroomStore(); let calls = 0; s.subscribe(() => calls++);
  const before = s.getSnapshot(); for (let i=0;i<120;i++) s.patch({ chapter:0,percent:0,finished:false });
  assert.equal(calls,0); assert.equal(s.getSnapshot(),before);
});
test('one atomic update publishes once; cleanup removes subscription', () => {
  const s = createShowroomStore(); let calls=0; const unsubscribe=s.subscribe(()=>calls++);
  s.patch({mode:'customize',finish:'graphite'}); assert.equal(calls,1);
  unsubscribe();s.patch({finish:'arancio'});assert.equal(calls,1);
});
test('configuration survives view-mode and assembly changes', () => {
  const s=createShowroomStore();s.patch({finish:'arancio'});
  for(const mode of ['explore','customize','photo'])s.patch({mode,inspecting:false,exploded:false});
  s.patch({finished:false,percent:0});assert.equal(s.getSnapshot().finish,'arancio');
});
test('snapshot and initial cabin are immutable', () => {
  const s=createShowroomStore();assert.throws(()=>{s.getSnapshot().finish='graphite'});
  assert.throws(()=>{s.getSnapshot().cabin.mode='inside'});
});
test('external persisted inputs are validated', () => {
  for(const value of [null,undefined,{},'ultra','__proto__']) {assert.equal(isQuality(value),false);assert.equal(isFinish(value),false);assert.equal(isMode(value),false);}
  assert.equal(isMode('photo'),true);assert.equal(isFinish('arancio'),true);assert.equal(isQuality('eco'),true);
});
test('tabs wrap and support Home and End', () => {
  assert.equal(modeAtKey('explore','ArrowLeft'),'photo');assert.equal(modeAtKey('photo','ArrowRight'),'explore');
  assert.equal(modeAtKey('customize','Home'),'explore');assert.equal(modeAtKey('explore','End'),'photo');assert.equal(modeAtKey('photo','Enter'),'photo');
});
test('React UI no longer injects HTML strings or delegates events to the root', () => {
  assert.equal(fs.existsSync('src/lib/controller.mjs'),false);assert.equal(fs.existsSync('src/lib/markup.mjs'),false);
  for(const file of fs.readdirSync('src/components/showroom'))assert.doesNotMatch(fs.readFileSync('src/components/showroom/'+file,'utf8'),/dangerouslySetInnerHTML|\.innerHTML\s*=/);
  assert.doesNotMatch(fs.readFileSync('src/components/Experience.tsx','utf8'),/dangerouslySetInnerHTML/);
  assert.doesNotMatch(fs.readFileSync('src/lib/showroom/runtime.ts','utf8'),/root\.addEventListener\(['"]click|\.textContent\s*=|\.innerHTML\s*=/);
});
test('public phase-one UI does not advertise unimplemented image export', () => {
  const source=fs.readFileSync('src/components/showroom/ModeNavigation.tsx','utf8');
  assert.match(source,/image export and lighting presets are not part of this release/);
  assert.doesNotMatch(source,/DOWNLOAD IMAGE|SAVE BUILD|EXPORT IMAGE/);
});
