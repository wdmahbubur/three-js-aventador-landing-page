import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG_KEYS,CONFIG_OPTIONS,DEFAULT_CONFIGURATION,normalizeConfiguration,changeConfiguration,validConfigOption,materialSlot} from '../src/lib/configuration.mjs';
import {DETAIL_IDS,DETAIL_CAMERAS} from '../src/lib/details.mjs';
import {createShowroomStore,isFinish} from '../src/lib/showroom/state.ts';

test('configuration defaults are complete and valid',()=>{for(const key of CONFIG_KEYS)assert.ok(validConfigOption(key,DEFAULT_CONFIGURATION[key]));assert.equal(CONFIG_OPTIONS.paint.length,6);});
test('untrusted configuration inputs cannot add fields or invalid options',()=>{
 for(const input of [undefined,null,{},'bad',JSON.parse('{"__proto__":{"polluted":true},"wheels":"evil","calipers":"giallo"}')]){
  const c=normalizeConfiguration(input);assert.deepEqual(Object.keys(c),CONFIG_KEYS);assert.equal(c.wheels,'graphite');assert.equal({}.polluted,undefined);
 }
 for(const key of ['__proto__','constructor','toString',''])assert.equal(validConfigOption(key,'rosso'),false);
});
test('every option is accepted, independent and immutable',()=>{
 for(const key of CONFIG_KEYS)for(const option of CONFIG_OPTIONS[key]){const c=changeConfiguration(DEFAULT_CONFIGURATION,key,option.id);assert.equal(c[key],option.id);assert.ok(Object.isFrozen(c));for(const other of CONFIG_KEYS.filter(k=>k!==key))assert.equal(c[other],DEFAULT_CONFIGURATION[other]);}
 assert.equal(changeConfiguration(DEFAULT_CONFIGURATION,'seats','unknown'),DEFAULT_CONFIGURATION);
});
test('UI finish validator accepts all six palette IDs, not arbitrary colours',()=>{for(const p of CONFIG_OPTIONS.paint)assert.ok(isFinish(p.id));assert.equal(isFinish('#ff0000'),false);});
test('wheel recolouring targets rim meshes, not tyres, logos or brake rotors',()=>{
 assert.equal(materialSlot('Wheel_FL','material','Wheel_FL_Rim_0'),'wheels');assert.equal(materialSlot('Wheel_FL','Caliper','Wheel_FL_Caliper_0'),'calipers');
 for(const name of ['Tire','Logo','Brake_rotor'])assert.equal(materialSlot('Wheel_FL',name,`Wheel_FL_${name}_0`),null);
});
test('seat inserts and cabin accents use different material scopes',()=>{
 assert.equal(materialSlot('Seat','Interior_color'),'seats');assert.equal(materialSlot('Interior_doors','Interior_color'),'accents');
 assert.equal(materialSlot('Seat','Interior_Black'),null);assert.equal(materialSlot('Interior_middle','Carbon'),null);assert.equal(materialSlot('Hood075','Windows'),null);
});
test('exterior carbon can be changed without altering dashboard carbon',()=>{assert.equal(materialSlot('Front_part_4','Carbon'),'carbon');assert.equal(materialSlot('Interior_middle_parts','Carbon'),null);});
test('replay and camera state do not discard a complete configuration',()=>{const s=createShowroomStore();const configuration=normalizeConfiguration({paint:'verde',wheels:'bronze',seats:'tan',paintFinish:'matte'});s.patch({configuration,finish:'verde'});s.patch({percent:0,mode:'explore',activeDetail:null});assert.equal(s.getSnapshot().configuration,configuration);assert.equal(createShowroomStore().getSnapshot().configuration.paint,'rosso');});
test('every detail has a finite bounded camera and unique ID',()=>{assert.equal(new Set(DETAIL_IDS).size,5);for(const id of DETAIL_IDS){const s=DETAIL_CAMERAS[id];assert.ok([...s.position,...s.target,s.fov].every(Number.isFinite));assert.ok(s.fov>=35&&s.fov<=65);}});

// Native disclosure and focus restoration must work without trapping keyboard users.
import { isVisibleFocusTarget } from '../src/lib/showroom/focus.ts';
const visibleStyle = () => 'visible';
const fakeControl = (closed = null, hidden = false) => ({ closest: selector => selector.startsWith('details') ? closed : hidden ? {} : null, getClientRects: () => [{}] });
test('closed disclosure descendants are excluded even when layout boxes remain', () => {const summary=fakeControl();const closed={querySelector:()=>summary};const select=fakeControl(closed);assert.equal(isVisibleFocusTarget(select,visibleStyle),false);});
test('open disclosure controls and its summary can receive focus', () => {const summary=fakeControl();const closed={querySelector:()=>summary};summary.closest=()=>closed;assert.equal(isVisibleFocusTarget(fakeControl(),visibleStyle),true);summary.closest=s=>s.startsWith('details')?closed:null;assert.equal(isVisibleFocusTarget(summary,visibleStyle),true);});
test('hidden, inert, missing and CSS-hidden focus targets are excluded', () => {assert.equal(isVisibleFocusTarget(null,visibleStyle),false);assert.equal(isVisibleFocusTarget(fakeControl(null,true),visibleStyle),false);assert.equal(isVisibleFocusTarget(fakeControl(),()=> 'hidden'),false);});
