import { clamp01 } from './timeline.mjs';

/** Restore the actual page pose after layout changes, without replaying a stale scrub target. */
export function synchronizeScrollAnimation(trigger, progress, update) {
  const value = clamp01(progress);
  // A refreshed scrub tween may still target the old viewport's progress. Do not
  // complete it: pause it and set the real animation to the fresh native position.
  trigger?.getTween?.()?.pause();
  trigger?.animation?.totalProgress(value, true);
  // GSAP suppresses animation callbacks during parts of refresh. Update the view
  // explicitly, even if the animation itself already has this totalProgress.
  update(value);
  return value;
}
