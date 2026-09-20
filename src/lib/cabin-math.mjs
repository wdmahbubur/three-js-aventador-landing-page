export const CABIN = Object.freeze({ eye: [.445, 1.045, -.075], pitch: -.24, minPitch: -.85, maxPitch: .55, maxYaw: 2.62, near: .008 });
export const clamp = (n, a, b) => Math.min(b, Math.max(a, Number.isFinite(n) ? n : a));
export const ease = n => { n = clamp(n, 0, 1); return n * n * (3 - 2 * n); };
export function approach(value, target, dt, reduced = false) {
  if (reduced || Math.abs(value - target) < .002) return target;
  const next = value + (target - value) * (1 - Math.exp(-Math.min(.5, Math.max(0, dt)) * 7));
  return Math.abs(next - target) < .002 ? target : next;
}
export function lookDirection(yaw, pitch) {
  yaw = clamp(yaw, -CABIN.maxYaw, CABIN.maxYaw); pitch = clamp(pitch, CABIN.minPitch, CABIN.maxPitch);
  return [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
}
export function cabinFov(aspect) { return aspect < 1 ? 78 : 70; }
