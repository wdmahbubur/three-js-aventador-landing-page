/** Deterministic renderer policy; no tracking, device fingerprinting, or analytics. */
export const QUALITY_MODES = ['auto', 'high', 'eco'];
export function renderBudget({ width = 1440, dpr = 1, memory = 8, cores = 8, quality = 'auto' } = {}) {
  const low = width <= 760 || memory <= 4 || cores <= 4;
  const cap = quality === 'eco' ? 1 : quality === 'high' ? 2 : low ? 1.25 : 1.6;
  return { pixelRatio: Math.min(Math.max(dpr || 1, .5), cap), shadowSize: quality === 'eco' || low ? 512 : 1024, anisotropy: low || quality === 'eco' ? 2 : 4 };
}
export function nextAdaptiveRatio(ratio, frameMs, samples, quality) {
  if (quality !== 'auto' || samples < 45 || frameMs <= 27) return ratio;
  return Math.max(.8, Math.round((ratio - .15) * 100) / 100);
}
export function allowAutomatic3D(connection) {
  return !(connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || ''));
}
/** Exponential easing in elapsed seconds, rather than an FPS-dependent fixed step. */
export function advanceExplosion(value, target, seconds, reduced = false) {
  if (reduced) return target;
  const next = value + (target - value) * (1 - Math.exp(-Math.max(0, seconds) * 8));
  return Math.abs(next - target) <= .001 ? target : next;
}
