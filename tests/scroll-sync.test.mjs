import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gsap } from 'gsap/dist/gsap.js';
import { synchronizeScrollAnimation } from '../src/lib/scroll-sync.mjs';
import { normalizedScroll } from '../src/lib/timeline.mjs';

test('A resized reveal uses physical scroll, not the stale scrub endpoint', () => {
  const events = [];
  const trigger = {
    getTween: () => ({ pause() { events.push('pause'); }, progress() { throw new Error('Stale target must not be completed'); } }),
    animation: { totalProgress(value, suppressed) { events.push(['position', value, suppressed]); } }
  };
  assert.equal(synchronizeScrollAnimation(trigger, 1, value => events.push(['view', value])), 1);
  assert.deepEqual(events, ['pause', ['position', 1, true], ['view', 1]]);
});
test('Native fallback and reduced motion do not require an active ScrollTrigger', () => {
  const values=[];
  synchronizeScrollAnimation(undefined, 1, p=>values.push(p));
  synchronizeScrollAnimation(undefined, -2, p=>values.push(p));
  synchronizeScrollAnimation(undefined, .42, p=>values.push(p));
  assert.deepEqual(values, [1,0,.42]);
});
test('Real GSAP proxy stays synchronized and resumes normal reverse scrubbing', () => {
  const proxy={value:0};
  const animation=gsap.fromTo(proxy,{value:0},{value:1,ease:'none',duration:1,paused:true});
  const scrub=gsap.to(animation,{totalProgress:.758497,duration:.55,paused:true});
  scrub.progress(.5);
  const trigger={animation,getTween:()=>scrub};
  let view=-1;
  synchronizeScrollAnimation(trigger,1,value=>view=value);
  assert.equal(view,1); assert.equal(proxy.value,1); assert.equal(scrub.paused(),true);
  scrub.resetTo('totalProgress',.3,animation.totalProgress()); scrub.progress(1);
  assert.ok(Math.abs(proxy.value-.3)<1e-6);
  synchronizeScrollAnimation(trigger,0,value=>view=value);
  assert.equal(proxy.value,0); assert.equal(view,0);
  scrub.kill(); animation.kill();
});
test('Fractional tablet track height reaches the exact reveal endpoint', () => {
  assert.equal(normalizedScroll(6963,0,7987.1875,1024),1);
  assert.equal(normalizedScroll(0,0,7987.1875,1024),0);
  assert.equal(normalizedScroll(3481.5,0,7987.1875,1024),.5);
});
test('Rounded scroll bounds preserve nonzero origins and reverse progress', () => {
  assert.equal(normalizedScroll(7063,100.125,7987.1875,1024),1);
  assert.equal(normalizedScroll(100,100.125,7987.1875,1024),0);
  assert.ok(normalizedScroll(7062,100.125,7987.1875,1024)<1);
});
