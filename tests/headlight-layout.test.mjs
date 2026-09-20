import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveHeadlightLayout, headlightTarget, headlightStrength, isProjector, lowBeamProfile, makeHeadlightCookie } from '../src/lib/headlight-layout.mjs';

const samples = [
  { position: [-.8, .5, 2], owner: 'left' }, { position: [-.7, .6, 2.1], owner: 'left' },
  { position: [.7, .5, 2], owner: 'right' }, { position: [.8, .6, 2.1], owner: 'right' }
];
test('identifies both genuine projector material names, not decorative lights', () => {
  for (const name of ['Headlight_light', 'Headlight_ligh_second', 'Headlight_Headlight_light_0']) assert.ok(isProjector(name), name);
  for (const name of ['Headlight_glass', 'Headlight', 'Inside_Headlight', 'Daylight_Light_0', 'Tail_light', 'Brake_light']) assert.equal(isProjector(name), false, name);
});
test('places two lamps at their mesh apertures with a small forward offset', () => {
  const layout = resolveHeadlightLayout(samples, [0, .5, -2]);
  assert.deepEqual(layout.forward, [0, 0, 1]);
  assert.deepEqual(layout.lamps.map((l) => l.owner), ['left', 'right']);
  for (const lamp of layout.lamps) {
    assert.ok(Math.abs(lamp.position[0] - lamp.side * .75) < 1e-8);
    assert.ok(Math.abs(lamp.position[1] - .55) < 1e-8);
    assert.ok(Math.abs(lamp.position[2] - 2.095) < 1e-8);
  }
});
test('detects rear-facing and X-axis cars without hardcoded +Z assumptions', () => {
  for (const angle of [Math.PI, Math.PI / 2, -.9]) {
    const rotate = ([x, y, z]) => [x * Math.cos(angle) + z * Math.sin(angle), y, -x * Math.sin(angle) + z * Math.cos(angle)];
    const layout = resolveHeadlightLayout(samples.map((s) => ({ ...s, position: rotate(s.position) })), rotate([0, .5, -2]));
    assert.ok(Math.abs(layout.forward[0] - Math.sin(angle)) < 1e-8);
    assert.ok(Math.abs(layout.forward[2] - Math.cos(angle)) < 1e-8);
  }
});
test('merged left/right projector geometry is split into exactly two origins', () => {
  const layout = resolveHeadlightLayout(samples.map((s) => ({ ...s, owner: 'Headlight' })), [0, 0, -2]);
  assert.equal(layout.lamps.length, 2);
  assert.ok(layout.lamps[0].position[0] < 0 && layout.lamps[1].position[0] > 0);
});
test('invalid or ambiguous geometry fails instead of emitting from guessed positions', () => {
  for (const points of [[], [{ position: [NaN, 0, 0] }], samples.map((s) => ({ ...s, position: [0, 0, 0] }))]) assert.throws(() => resolveHeadlightLayout(points));
});
test('targets aim forward and downward with small outward separation', () => {
  const layout = resolveHeadlightLayout(samples, [0, .5, -2]);
  for (const lamp of layout.lamps) {
    const target = headlightTarget(lamp.position, layout.forward, layout.right, lamp.side);
    assert.ok(target[2] > lamp.position[2] + 7.9);
    assert.ok(target[1] < lamp.position[1]);
    assert.ok((target[0] - lamp.position[0]) * lamp.side > 0);
  }
});
test('beams stay off during assembly and become fully lit after the reveal', () => {
  for (const p of [0, .5, .925, .945, .947]) assert.equal(headlightStrength(p), 0);
  assert.equal(headlightStrength(1), 1);
  assert.ok(headlightStrength(.98) > 0 && headlightStrength(.98) < 1);
});
test('toggle off removes both light and haze power even at full reveal', () => {
  for (const p of [0, .96, .98, 1]) assert.equal(headlightStrength(p, 0, false), 0);
});
test('exploded view fades beams to zero rather than shining from floating panels', () => {
  assert.equal(headlightStrength(1, 0), 1);
  assert.ok(headlightStrength(1, .06) < 1);
  assert.equal(headlightStrength(1, .12), 0);
  assert.equal(headlightStrength(1, 1), 0);
});
test('forward and reverse scrolling yield identical light power', () => {
  const samples = Array.from({ length: 101 }, (_, i) => .9 + i / 1000);
  const expected = new Map(samples.map((p) => [p, headlightStrength(p)]));
  for (const p of samples.reverse()) assert.equal(headlightStrength(p), expected.get(p));
});
test('low beam mask has a wide horizontal hotspot and a dark upper cutoff', () => {
  assert.ok(lowBeamProfile(0, -.17) > .95);
  assert.ok(lowBeamProfile(.45, -.17) > lowBeamProfile(0, .3));
  assert.equal(lowBeamProfile(0, .4), 0);
  assert.equal(lowBeamProfile(1, -.17), 0);
});
test('cookie pixels are deterministic, finite and bounded', () => {
  const a = makeHeadlightCookie(32), b = makeHeadlightCookie(32);
  assert.deepEqual(a, b); assert.equal(a.length, 32 * 32 * 4);
  assert.ok(a.some((v, i) => i % 4 !== 3 && v > 200));
  assert.throws(() => makeHeadlightCookie(0));
});
