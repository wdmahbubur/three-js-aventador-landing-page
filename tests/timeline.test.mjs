import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp01, smooth, smoother, interval, normalizedScroll, chapterIndex, hashString, classifyPart, WINDOWS, partWindow, entryOffset, partPose, cameraPose } from '../src/lib/timeline.mjs';
import { CHAPTERS } from '../src/lib/config.mjs';

test('clamp handles nonfinite and out-of-range progress', () => {
  for (const value of [NaN, Infinity, -Infinity, -1, -999]) assert.equal(clamp01(value), 0);
  assert.equal(clamp01(.4), .4); assert.equal(clamp01(100), 1);
});
test('eases preserve endpoints and are monotone', () => {
  for (const ease of [smooth, smoother]) {
    assert.equal(ease(0), 0); assert.equal(ease(1), 1);
    let previous = -1;
    for (let i = 0; i <= 1000; i++) { const value = ease(i / 1000); assert.ok(value >= previous - 1e-12 && value <= 1); previous = value; }
  }
});
test('interval clamps outside its range and handles a zero-length interval', () => {
  assert.equal(interval(.1, .2, .4), 0); assert.equal(interval(.5, .2, .4), 1);
  assert.equal(interval(.5, .5, .5), 1); assert.equal(interval(.4, .5, .5), 0);
  assert.ok(Math.abs(interval(.3, .2, .4) - .5) < 1e-10);
});
test('native scrolling normalizes document offsets and limits', () => {
  assert.equal(normalizedScroll(100, 100, 9000, 1000), 0);
  assert.equal(normalizedScroll(4100, 100, 9000, 1000), .5);
  assert.equal(normalizedScroll(8100, 100, 9000, 1000), 1);
  assert.equal(normalizedScroll(-1, 0, 9000, 1000), 0);
  assert.equal(normalizedScroll(100, 0, 1000, 1000), 1);
});
test('chapter transitions occur at the authored boundaries', () => {
  CHAPTERS.forEach((chapter, i) => {
    assert.equal(chapterIndex(chapter.at), i);
    if (i) assert.equal(chapterIndex(chapter.at - .00001), i - 1);
  });
  assert.equal(chapterIndex(1), CHAPTERS.length - 1);
});
test('hashing and per-part timing are stable, not random per render', () => {
  assert.equal(hashString('Wheel_FR'), hashString('Wheel_FR'));
  assert.notEqual(hashString('Wheel_FR'), hashString('Wheel_FL'));
  assert.deepEqual(partWindow('wheels', 'Wheel_FR'), partWindow('wheels', 'Wheel_FR'));
});
for (const [name, expected] of [
  ['Wheel_FR', 'wheels'], ['Wheel_FL_Tire_0', 'wheels'], ['Wheel_BR_Brake_rotor_0', 'wheels'],
  ['Daylight_Part', 'lights'], ['Headlight', 'lights'], ['Tail_light', 'lights'],
  ['Engine', 'powertrain'], ['Exhaust_1', 'powertrain'], ['Illustrative_support_frame', 'foundation'],
  ['Seat', 'cockpit'], ['Interior_middle_parts', 'cockpit'], ['Steering_wheel', 'cockpit'],
  ['Mirrors', 'mirrors'], ['Hood075', 'bodywork'], ['Glass', 'glass'],
  ['Rear_engine_carbon', 'aero'], ['Front_part_1', 'trim']
]) test(`classifies actual model name ${name} as ${expected}`, () => assert.equal(classifyPart(name), expected));
test('wheels enter from opposite sides and mobile distances are shorter', () => {
  const right = entryOffset('wheels', [1, .4, 1], 'Wheel_FR');
  const left = entryOffset('wheels', [-1, .4, 1], 'Wheel_FL');
  assert.ok(right[0] > 0 && left[0] < 0);
  assert.deepEqual(entryOffset('wheels', [1, .4, 1], 'Wheel_FR', true), right.map((n) => n * .62));
});
test('every category is absent initially and fully seated at the end', () => {
  for (const category of Object.keys(WINDOWS)) {
    const key = `${category}_test`, [start, end] = partWindow(category, key);
    assert.ok(start > 0 && end < 1 && end > start);
    const offset = entryOffset(category, [1, 1, 1], key);
    const first = partPose(0, start, end, offset, [.1, .2, .3]);
    const last = partPose(1, start, end, offset, [.1, .2, .3]);
    assert.equal(first.visible, false); assert.equal(last.visible, true); assert.equal(last.assembled, true);
    assert.deepEqual(last.offset.map((n) => Math.abs(n)), [0, 0, 0]); assert.deepEqual(last.rotation.map((n) => Math.abs(n)), [0, 0, 0]);
  }
});
test('seeking backwards reconstructs exactly the same poses as forward playback', () => {
  const [start, end] = partWindow('bodywork', 'Hood075');
  const offset = [3, 4, 5], rotation = [.12, -.25, .09];
  const samples = Array.from({ length: 101 }, (_, i) => i / 100);
  const forward = new Map(samples.map((p) => [p, partPose(p, start, end, offset, rotation)]));
  for (const p of [...samples].reverse()) assert.deepEqual(partPose(p, start, end, offset, rotation), forward.get(p));
});
test('fast and out-of-order jumps do not require prior animation events', () => {
  for (const p of [.99, .1, .77, 0, .5, 1]) {
    const pose = partPose(p, .2, .5, [1, 2, 3], [.1, 0, -.1]);
    assert.equal(pose.visible, p > .2); assert.equal(pose.assembled, p >= .5);
  }
});
test('exploded view adds a separate reversible offset', () => {
  assert.deepEqual(partPose(1, .2, .4, [5, 5, 5], [1, 1, 1], 1, [2, 3, 4]).offset, [2, 3, 4]);
  assert.deepEqual(partPose(1, .2, .4, [5, 5, 5], [1, 1, 1], 0, [2, 3, 4]).offset, [0, 0, 0]);
});
test('camera remains finite across scroll positions and common aspect ratios', () => {
  for (const aspect of [.25, 390 / 844, .8, 1, 16 / 9, 21 / 9]) {
    for (let i = 0; i <= 100; i++) {
      const pose = cameraPose(i / 100, aspect);
      for (const value of [...pose.position, ...pose.target, pose.fov, pose.offsetX, pose.offsetY]) assert.ok(Number.isFinite(value));
      assert.ok(pose.position[1] > 0 && pose.fov >= 35 && pose.fov <= 40);
    }
  }
});
test('portrait camera pulls back and eliminates horizontal story offset', () => {
  const portrait = cameraPose(.7, .46), desktop = cameraPose(.7, 16 / 9);
  assert.equal(portrait.offsetX, 0); assert.ok(Math.abs(portrait.position[2]) > Math.abs(desktop.position[2]));
});
