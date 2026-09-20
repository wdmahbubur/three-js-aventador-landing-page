import { CHAPTERS } from './config.mjs';

export const clamp01 = (n) => Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp01(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export function interval(progress, start, end) {
  if (end <= start) return progress >= end ? 1 : 0;
  return smoother((progress - start) / (end - start));
}
export function normalizedScroll(scrollY, top, trackHeight, viewportHeight) {
  // Match the whole-CSS-pixel endpoint used by chapter jumps and ScrollTrigger.
  // Fractional svh heights must still yield an exactly complete final reveal.
  const start = Math.round(top);
  const end = Math.round(top + trackHeight - viewportHeight);
  return clamp01((scrollY - start) / Math.max(1, end - start));
}
export function chapterIndex(progress) {
  let index = 0;
  for (let i = 1; i < CHAPTERS.length; i++) if (progress >= CHAPTERS[i].at) index = i;
  return index;
}
export function hashString(text) {
  let hash = 2166136261;
  for (const char of text) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

/** Semantic categories are based on this asset's published names, not random mesh order. */
export function classifyPart(name, materialNames = '') {
  const n = name.toLowerCase();
  const material = materialNames.toLowerCase();
  if (/wheel[_ .-]?(fr|fl|br|bl|rr|rl)/.test(n) || /tire|tyre|rim|caliper|brake_rotor/.test(n)) return 'wheels';
  if (/daylight|headlight|tail.?light|brake_light|turning_light/.test(n) && !/hood/.test(n)) return 'lights';
  if (/mirror/.test(n)) return 'mirrors';
  if (/glass|window|windscreen|windshield/.test(n) && !/hood/.test(n)) return 'glass';
  if (/^engine|^exhaust|transmission|gearbox|powertrain/.test(n)) return 'powertrain';
  if (/chassis|underbody|undertray|floor|bottom|frame/.test(n)) return 'foundation';
  if (/interior|seat|steering|speedometer|dashboard|pedal|console|cluster/.test(n)) return 'cockpit';
  if (/spoiler|wing|rear_engine_carbon|logo|emblem|badge/.test(n)) return 'aero';
  if (/hood|door|fender|body|roof|bumper|sill|side/.test(n) || /^(body|paint)$/.test(material)) return 'bodywork';
  return 'trim';
}

export const WINDOWS = Object.freeze({
  foundation: [.095, .225], powertrain: [.23, .35], wheels: [.35, .485],
  cockpit: [.48, .625], bodywork: [.615, .805], trim: [.62, .83],
  aero: [.76, .875], glass: [.805, .9], mirrors: [.835, .925], lights: [.865, .945]
});

export function partWindow(category, key) {
  const [start, end] = WINDOWS[category] || WINDOWS.trim;
  const delay = (hashString(key) % 1000) / 1000 * (end - start) * .24;
  return [start + delay, end];
}
export function entryOffset(category, center, key, mobile = false) {
  const scale = mobile ? .62 : 1;
  const side = Math.abs(center[0]) > .08 ? Math.sign(center[0]) : (hashString(key) % 2 ? 1 : -1);
  const front = center[2] >= 0 ? 1 : -1;
  const result = {
    foundation: [0, -1.6, 0], powertrain: [0, 2.8, -1.5],
    wheels: [side * 3.3, .15, front * .35], cockpit: [side * .35, 3.2, 0],
    bodywork: [side * 2.1, 2.3, front * 1.5], trim: [side * 2.5, .9, front * 1.8],
    aero: [0, 2.5, -1.8], glass: [0, 3.0, .6],
    mirrors: [side * 3, 1.2, .3], lights: [side * .7, .45, front * 3.0]
  }[category] || [side * 2, 2, front];
  return result.map((n) => n * scale);
}

export function partPose(progress, start, end, offset, rotation, explosion = 0, explodeOffset = [0, 0, 0]) {
  const t = interval(progress, start, end);
  return {
    visible: progress > start || explosion > 0,
    assembled: t === 1,
    arrival: t,
    offset: offset.map((value, i) => value * (1 - t) + explodeOffset[i] * explosion),
    rotation: rotation.map((value) => value * (1 - t)),
    scale: 1
  };
}

const CAMERAS = [
  [0, 6.6, 3.0, 8.6], [.12, 6.6, 3.4, 8.6], [.27, 7.8, 3.5, -5.0],
  [.4, 8.6, 2.0, -1.8], [.54, 6.2, 4.5, 4.6], [.74, 6.1, 2.3, 7.6],
  [.9, 5.8, 2.4, 8.2], [1, 5.4, 2.1, 7.5]
];
export function cameraPose(progress, aspect = 16 / 9, explosion = 0) {
  const p = clamp01(progress);
  let i = 0;
  while (i < CAMERAS.length - 2 && p > CAMERAS[i + 1][0]) i++;
  const a = CAMERAS[i], b = CAMERAS[i + 1];
  const t = smooth((p - a[0]) / (b[0] - a[0]));
  const mobile = aspect < .85;
  const fit = Math.max(1, .72 / Math.max(aspect, .25)) * (1 + explosion * .19);
  return {
    position: [lerp(a[1], b[1], t) * fit, lerp(a[2], b[2], t) * (mobile ? 1.2 : 1), lerp(a[3], b[3], t) * fit],
    target: [0, .64, 0],
    fov: mobile ? 40 : 35,
    offsetX: mobile ? 0 : -.105 * (1 - interval(p, .89, 1)),
    offsetY: mobile ? -.09 : -.045
  };
}
