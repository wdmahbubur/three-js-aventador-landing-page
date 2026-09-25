import { flushSync } from 'react-dom';
import type { gsap as GSAP } from 'gsap';
import type { ScrollTrigger as Trigger } from 'gsap/ScrollTrigger';
import { CHAPTERS } from '../config.mjs';
import { clamp01, chapterIndex, interval, normalizedScroll } from '../timeline.mjs';
import { synchronizeScrollAnimation } from '../scroll-sync.mjs';
import { allowAutomatic3D } from '../performance.mjs';
import { isFinish, isMode, isQuality, type Action, type CabinState, type Mode } from './state';
import type { EngineConstructor, EnginePort, Runtime, RuntimeOptions } from './contracts';

/** Owns external systems, NOT UI markup. React owns text, controls, attributes and events.
 * Only continuous animation CSS variables, native scroll/focus, observers and WebGL are imperative.
 */
export function mountShowroom({ root, track, host, cabinOverlay, interiorLauncher, store }: RuntimeOptions): Runtime {
  const abort = new AbortController(), signal = abort.signal;
  const read = store.getSnapshot;
  let disposed = false, engine: EnginePort | undefined, current = 0, frame = 0, settleFrame = 0;
  let idleTask: number | undefined, loadGeneration = 0, graphicsStarted = false;
  let restoring = false, cabinReturnProgress = 1, cabinFocus: HTMLElement | null = null;
  let gsap: typeof GSAP | undefined, ScrollTrigger: typeof Trigger | undefined;
  let tween: ReturnType<typeof import('gsap').gsap.to> | undefined, trigger: Trigger | undefined;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let storedMotion: string | null = null;
  try { storedMotion = localStorage.getItem('revuelto-motion'); } catch { /* Private mode may disable storage. */ }
  let reduced = storedMotion ? storedMotion === 'reduced' : media.matches;
  let quality = read().quality;
  try { const saved = localStorage.getItem('revuelto-quality'); if (isQuality(saved)) quality = saved; } catch {}
  const announce = (announcement: string) => { if (!disposed) store.patch({ announcement }); };
  const geometry = () => { const rect = track.getBoundingClientRect(); return { top: rect.top + scrollY, height: rect.height, viewport: innerHeight }; };
  const ready = () => read().engine === 'ready';
  const inside = () => read().cabin.mode !== 'exterior';
  function stateStatus() {
    if (ready()) store.patch({ status: current >= .965 ? 'Assembly complete. Explore, customize or compose a view.' : current < .08 ?
      'Scroll down to assemble. Scroll up to reverse.' : 'Scroll down to build · up to reverse.' });
  }
  function setInspect(value: boolean, keepFocus = false) {
    const focus = document.activeElement;
    const inspecting = Boolean(value && ready() && current >= .965 && !inside());
    engine?.setInspect(inspecting); store.patch({ inspecting });
    if (keepFocus && focus instanceof HTMLElement) focus.focus({ preventScroll: true });
    if (inspecting) announce('Drag to rotate. Arrow keys rotate or zoom. Escape exits inspection.');
  }
  function setExplode(value: boolean) {
    const exploded = Boolean(value && ready() && current >= .965 && !inside());
    engine?.setExploded(exploded); store.patch({ exploded });
  }
  function setCleanView(value: boolean) {
    if (read().cleanView === value) return;
    restoring = true;
    flushSync(() => store.patch({ cleanView: value }));
    document.documentElement.classList.toggle('photo-locked', value);
    if (!value) {
      ScrollTrigger?.refresh();
      const { top, height, viewport } = geometry();
      window.scrollTo({ top: top + Math.max(0, height - viewport), behavior: 'instant' });
      (ScrollTrigger?.update as ((force?: boolean) => void) | undefined)?.(true);
    }
    restoring = false;
    if (!value) settleScrollPose();
    (root.querySelector<HTMLButtonElement>(value ? '[data-restore-ui]' : '[data-action="clean-photo"]'))?.focus({ preventScroll: true });
  }
  function selectMode(mode: Mode) {
    if (!isMode(mode) || inside() || !read().finished) return;
    setCleanView(false); setInspect(false, true); setExplode(false);
    store.patch({ mode, cleanView: false });
    if (mode === 'photo') setInspect(true, true);
    announce(mode === 'photo' ? 'Photo workspace. Drag to compose your view.' : `${mode === 'explore' ? 'Explore' : 'Customize'} workspace.`);
  }
  function syncCabin(cabin: CabinState) {
    if (disposed) return;
    const active = cabin.mode !== 'exterior', leaving = inside() && !active;
    if (!inside() && active) cabinReturnProgress = current;
    if (leaving) restoring = true;
    const previous = read().cabin;
    if (Object.keys(cabin).some(key => cabin[key as keyof CabinState] !== previous[key as keyof CabinState])) {
      // Commit the fixed-stage layout BEFORE measuring scroll bounds on entry/exit.
      flushSync(() => store.patch({ cabin: Object.freeze({ ...cabin }) }));
    }
    document.documentElement.classList.toggle('cabin-locked', active);
    if (active) engine?.setActive(true);
    if (leaving) {
      ScrollTrigger?.refresh();
      const { top, height, viewport } = geometry();
      window.scrollTo({ top: top + cabinReturnProgress * Math.max(0, height - viewport), behavior: 'instant' });
      (ScrollTrigger?.update as ((force?: boolean) => void) | undefined)?.(true); restoring = false; settleScrollPose(); engine?.setActive(true);
      cabinFocus?.focus({ preventScroll: true });
    }
    if (active) announce(cabin.mode === 'inside' ? 'Inside the cabin. Drag or use arrow keys to look around. Escape exits.' :
      cabin.mode === 'exiting' ? 'Returning to the showroom.' : 'Opening the doors and entering the cabin.');
  }
  function update(progress: number) {
    if (disposed || inside() || read().cleanView || restoring) return;
    const next = reduced ? 1 : clamp01(progress), finished = next >= .965;
    const before = read();
    current = next;
    // These variables are not React props; 60 Hz animation does not re-render the UI.
    root.style.setProperty('--progress', String(current));
    root.style.setProperty('--intro-opacity', String(1 - interval(current, .018, .102)));
    root.style.setProperty('--intro-y', `${-interval(current, .01, .11) * 45}px`);
    const chapter = chapterIndex(current);
    if (!finished) {
      if (before.inspecting) setInspect(false);
      if (before.exploded) setExplode(false);
    }
    store.patch({ percent: Math.round(current * 100), chapter, finished, introHidden: current >= .095,
      ...(!finished ? { mode: 'explore' as const, cleanView: false } : {}) });
    engine?.setProgress(current);
    if (chapter !== before.chapter) announce(CHAPTERS[chapter].kicker);
    if (chapter !== before.chapter || finished !== before.finished) stateStatus();
  }
  function updateFromScroll() {
    frame = 0;
    if (disposed || trigger || reduced) return;
    const { top, height, viewport } = geometry(); update(normalizedScroll(scrollY, top, height, viewport));
  }
  function requestUpdate() { if (!frame && !disposed && !trigger) frame = requestAnimationFrame(updateFromScroll); }
  function settleScrollPose(target = trigger) {
    if (disposed || inside() || read().cleanView || restoring) return;
    const { top, height, viewport } = geometry();
    synchronizeScrollAnimation(target, reduced ? 1 : normalizedScroll(scrollY, top, height, viewport), update);
  }
  function jump(progress: number, immediate = false) {
    if (disposed) return;
    setCleanView(false); engine?.resetCabin(); setInspect(false); setExplode(false);
    store.patch({ mode: 'explore', cleanView: false });
    if (reduced && progress < .93) {
      setMotion(false, true); cancelAnimationFrame(settleFrame);
      settleFrame = requestAnimationFrame(() => { if (!disposed) jump(progress, immediate); }); return;
    }
    ScrollTrigger?.refresh();
    const { top, height, viewport } = geometry();
    window.scrollTo({ top: top + clamp01(progress) * Math.max(0, height - viewport), behavior: reduced || immediate ? 'instant' : 'smooth' });
    if (immediate || reduced) {
      (ScrollTrigger?.update as ((force?: boolean) => void) | undefined)?.(true); settleScrollPose(); cancelAnimationFrame(settleFrame);
      settleFrame = requestAnimationFrame(() => { settleFrame = 0; settleScrollPose(); }); requestUpdate();
    }
  }
  function installScroll() {
    trigger?.kill(); tween?.kill(); trigger = undefined; tween = undefined;
    if (reduced) { update(1); return; }
    if (gsap && ScrollTrigger) {
      const proxy = { value: 0 };
      tween = gsap.fromTo(proxy, { value: 0 }, { value: 1, duration: 1, ease: 'none', onUpdate: () => update(proxy.value),
        scrollTrigger: { trigger: track, start: 'top top', end: 'bottom bottom', scrub: .55, onRefresh: self => settleScrollPose(self) } });
      trigger = tween.scrollTrigger;
      ScrollTrigger.refresh(); (ScrollTrigger.update as (force?: boolean) => void)(true); settleScrollPose();
    } else updateFromScroll();
  }
  function setMotion(value: boolean, persist = false) {
    reduced = value;
    flushSync(() => store.patch({ reduced }));
    if (persist) { storedMotion = reduced ? 'reduced' : 'full'; try { localStorage.setItem('revuelto-motion', storedMotion); } catch {} }
    setInspect(false); setExplode(false); engine?.setReduced(reduced); installScroll();
    cancelAnimationFrame(settleFrame);
    settleFrame = requestAnimationFrame(() => { if (!disposed) { ScrollTrigger?.refresh(); requestUpdate(); } });
  }
  function fail(error: unknown) {
    if (disposed) return;
    // Dispose callbacks must not write a stale cabin snapshot into the replacement engine.
    loadGeneration++; engine?.dispose(); engine = undefined; graphicsStarted = false;
    document.documentElement.classList.remove('cabin-locked', 'photo-locked');
    store.patch({ engine: 'error', status: '3D unavailable. You can still explore the design below.', inspecting: false,
      exploded: false, cleanView: false, cabin: Object.freeze({ mode: 'exterior', available: false, doorsOpen: false, error: String(error) }) });
    console.warn('[Revuelto] 3D initialization failed:', error);
  }
  function startGraphics() {
    if (graphicsStarted || disposed) return;
    graphicsStarted = true; const generation = ++loadGeneration;
    const live = () => !disposed && generation === loadGeneration;
    store.patch({ engine: 'loading', status: 'Preparing the interactive showroom…' });
    import('../cabin-renderer.mjs').then(({ AssemblyEngine }) => {
      if (!live()) return;
      const Renderer = AssemblyEngine as unknown as EngineConstructor;
      engine = new Renderer(host, { reduced,
        onStatus: status => { if (live()) store.patch({ status }); },
        onCabinState: state => { if (live()) syncCabin(state); },
        onReady: () => {
          if (!live()) return;
          store.patch({ engine: 'ready' });
          engine?.setProgress(current); engine?.setQuality(read().quality); engine?.setFinish(read().finish);
          engine?.setLights(read().lights); engine?.setActive(true); engine?.emitCabinState();
          if (read().mode === 'photo') setInspect(true, true);
          stateStatus();
        }, onError: error => { if (live()) fail(error); }, onExitInspect: () => { if (live()) setInspect(false); }
      });
      engine.setProgress(current); engine.setQuality(read().quality);
    }).catch(error => { if (live()) fail(error); });
  }
  function send(action: Action) {
    if (disposed) return;
    switch (action.type) {
      case 'jump': jump(action.progress, action.immediate); return;
      case 'reveal': jump(1); return;
      case 'replay': jump(0); return;
      case 'mode': selectMode(action.mode); return;
      case 'credits': store.patch({ creditsOpen: true }); return;
      case 'close-credits': store.patch({ creditsOpen: false }); return;
      case 'retry': loadGeneration++; engine?.dispose(); engine = undefined; graphicsStarted = false; startGraphics(); return;
      case 'quality':
        if (!isQuality(action.quality)) return;
        store.patch({ quality: action.quality }); engine?.setQuality(action.quality);
        try { localStorage.setItem('revuelto-quality', action.quality); } catch {} return;
      case 'motion': { const { top } = geometry(); setMotion(!reduced, true); window.scrollTo({ top, behavior: 'instant' }); return; }
      case 'finish': case 'reset-finish': {
        const finish = action.type === 'finish' ? action.finish : 'rosso';
        if (!ready() || !isFinish(finish)) return;
        store.patch({ finish }); engine?.setFinish(finish); announce(`Presentation finish: ${finish}.`); return;
      }
    }
    if (!ready() || !read().finished) return;
    switch (action.type) {
      case 'inspect': setInspect(!read().inspecting); break;
      case 'explode': setExplode(!read().exploded); break;
      case 'lights': store.patch({ lights: !read().lights }); engine?.setLights(read().lights); break;
      case 'doors': case 'cabin-doors': engine?.setDoors(!read().cabin.doorsOpen); break;
      case 'interior':
        cabinFocus = interiorLauncher; setInspect(false); setExplode(false);
        if (!engine?.setInterior(true)) announce('Interior is available after the car is fully assembled.'); break;
      case 'exit-interior': engine?.setInterior(false); break;
      case 'cabin-front': engine?.setCabinView('dashboard'); break;
      case 'cabin-left': engine?.setCabinView('left'); break;
      case 'cabin-passenger': engine?.setCabinView('passenger'); break;
      case 'reset-camera': setInspect(false, true); if (read().mode === 'photo') setInspect(true, true); break;
      case 'clean-photo':
        if (read().mode !== 'photo' || inside()) return;
        setCleanView(!read().cleanView); break;
    }
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && read().cleanView) { event.preventDefault(); event.stopImmediatePropagation(); setCleanView(false); }
  }, { signal, capture: true });
  document.addEventListener('keydown', event => {
    if (read().creditsOpen) return; // Native dialog owns its keyboard interaction.
    if (inside()) {
      if (event.key === 'Escape') { event.preventDefault(); engine?.setInterior(false); }
      if (event.key === 'Tab') {
        const controls = [host.querySelector('canvas'), ...cabinOverlay.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter((el): el is HTMLButtonElement | HTMLCanvasElement => el !== null);
        const index = controls.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault(); controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus({ preventScroll: true });
      }
      if (['PageDown', 'PageUp', 'End', ' '].includes(event.key) && (event.target as HTMLElement)?.tagName !== 'BUTTON') event.preventDefault();
    } else if (read().cleanView && event.key === 'Tab') {
      event.preventDefault(); const canvas = host.querySelector('canvas'), button = root.querySelector<HTMLButtonElement>('[data-restore-ui]');
      (document.activeElement === canvas ? button : canvas)?.focus({ preventScroll: true });
    } else if (event.key === 'Escape') {
      if (read().cleanView) send({ type: 'clean-photo' });
      else if (read().inspecting) setInspect(false);
    }
  }, { signal });
  media.addEventListener('change', () => { if (!storedMotion) setMotion(media.matches); }, { signal });
  window.addEventListener('scroll', requestUpdate, { passive: true, signal });
  window.addEventListener('resize', requestUpdate, { passive: true, signal });
  window.addEventListener('pageshow', () => { ScrollTrigger?.refresh(); requestUpdate(); }, { signal });
  const resizeObserver = new ResizeObserver(() => { ScrollTrigger?.refresh(); requestUpdate(); }); resizeObserver.observe(track);
  const stageObserver = new IntersectionObserver(([entry]) => { engine?.setActive(entry.isIntersecting || inside()); }); stageObserver.observe(track);
  // Editorial reveal classes are decorative only, never hide accessible content.
  const editorialObserver = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('is-visible'); editorialObserver.unobserve(entry.target); }
  }, { threshold: .08 });
  root.querySelectorAll('[data-editorial]').forEach(section => editorialObserver.observe(section));
  store.patch({ quality }); setMotion(reduced); update(reduced ? 1 : 0);
  document.fonts?.ready.then(() => { if (!disposed) store.patch({ fontsReady: true }); });
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (allowAutomatic3D(connection)) {
    idleTask = 'requestIdleCallback' in globalThis ? requestIdleCallback(startGraphics, { timeout: 900 }) : window.setTimeout(startGraphics, 80);
  } else store.patch({ engine: 'deferred', status: 'Data Saver · enable 3D when ready.' });
  Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([core, plugin]) => {
    if (disposed) return; gsap = core.gsap; ScrollTrigger = plugin.ScrollTrigger; gsap.registerPlugin(ScrollTrigger); installScroll();
  }).catch(() => { /* Native scroll remains functional without GSAP. */ });
  const debug = {
    getState: () => ({ progress: current, chapter: read().chapter, reduced, ready: ready(), engineError: read().engine === 'error',
      inspect: read().inspecting, ...engine?.getState(), ui: read(),
      scroll: { y: scrollY, ...geometry(), triggerStart: trigger?.start, triggerEnd: trigger?.end, triggerProgress: trigger?.progress } }),
    seek: (progress: number) => jump(progress, true)
  };
  const debugWindow = window as Window & { __REVUELTO__?: typeof debug };
  if (new URLSearchParams(location.search).has('debug') || root.hasAttribute('data-debug')) debugWindow.__REVUELTO__ = debug;
  return { send, dispose() {
    disposed = true; loadGeneration++; abort.abort();
    cancelAnimationFrame(frame); cancelAnimationFrame(settleFrame);
    if (idleTask !== undefined) { if ('cancelIdleCallback' in globalThis) cancelIdleCallback(idleTask); else clearTimeout(idleTask); }
    resizeObserver.disconnect(); stageObserver.disconnect(); editorialObserver.disconnect(); trigger?.kill(); tween?.kill();
    engine?.dispose(); document.documentElement.classList.remove('cabin-locked', 'photo-locked');
    if (debugWindow.__REVUELTO__ === debug) delete debugWindow.__REVUELTO__;
  } };
}
