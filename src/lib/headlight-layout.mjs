/** Pure headlight geometry/power helpers, independent of WebGL and the camera. */
const clamp = (x) => Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0;
const ease = (x) => { const t = clamp(x); return t * t * (3 - 2 * t); };
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const add = (a, b, scale = 1) => a.map((x, i) => x + b[i] * scale);
function centre(points) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of points) for (let i = 0; i < 3; i++) {
    lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]);
  }
  return lo.map((x, i) => (x + hi[i]) / 2);
}

export function isProjector(name = '') {
  // Actual asset names include the creator's "Headlight_ligh_second" typo.
  return /headlight[_ .-]+ligh(?:t)?(?:[_ .-]+(?:second|0))?(?:[_ .-]|$)/i.test(name);
}

/** Separate a merged pair of projector meshes using the car's own longitudinal axis. */
export function resolveHeadlightLayout(samples, rear = [0, 0, 0]) {
  if (!Array.isArray(samples) || samples.length < 2 || samples.some(({ position }) =>
    !Array.isArray(position) || position.length !== 3 || position.some((v) => !Number.isFinite(v)))) {
    throw new Error('Headlight layout needs finite vertices from both front projectors.');
  }
  const front = centre(samples.map((s) => s.position));
  const delta = sub(front, rear); delta[1] = 0;
  const length = Math.hypot(...delta);
  if (length < .1) throw new Error('Cannot determine the car forward direction.');
  const forward = delta.map((x) => x / length);
  const right = [forward[2], 0, -forward[0]];
  const lamps = [-1, 1].map((side) => {
    const half = samples.filter((s) => dot(sub(s.position, front), right) * side > .001);
    if (!half.length) throw new Error('Both left and right headlight projectors must be present.');
    // Select an actual owner, never a guessed world-space offset or the camera.
    const owners = new Map();
    half.forEach((s) => owners.set(s.owner, (owners.get(s.owner) || 0) + 1));
    const owner = [...owners].sort((a, b) => b[1] - a[1])[0][0];
    const position = add(centre(half.map((s) => s.position)), forward, .045);
    return { side, owner, position };
  });
  return { forward, right, lamps };
}

export function headlightTarget(position, forward, right, side) {
  const target = add(add(position, forward, 8), right, side * .24);
  // A shallow, downward aim: illuminate the road, not the viewer's camera.
  target[1] = Math.min(position[1] - .08, .03);
  return target;
}

export function headlightStrength(progress, exploded = 0, lightsOn = true, readyAt = .947) {
  if (!lightsOn || !Number.isFinite(progress) || progress <= readyAt) return 0;
  return ease((progress - readyAt) / Math.max(.001, 1 - readyAt)) * (1 - ease(exploded / .12));
}

/** Low-beam-style cookie, not a road-certified optical pattern. +y is upward. */
export function lowBeamProfile(x, y) {
  const width = Math.exp(-Math.pow(x / .76, 4));
  const hotspot = Math.exp(-Math.pow((y + .17) / .28, 2));
  const cutoff = 1 - ease((y - .025) / .085);
  const edge = 1 - ease((Math.hypot(x, y) - .83) / .17);
  return clamp(width * hotspot * cutoff * edge);
}

export function makeHeadlightCookie(size = 128) {
  if (!Number.isInteger(size) || size < 8 || size > 512) throw new Error('Invalid headlight cookie size.');
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const value = Math.round(255 * lowBeamProfile(x / (size - 1) * 2 - 1, y / (size - 1) * 2 - 1));
    const offset = (y * size + x) * 4;
    data.set([value, value, value, 255], offset);
  }
  return data;
}
