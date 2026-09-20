import { CHAPTERS, FINISHES } from './config.mjs';
import { clamp01, chapterIndex, interval, normalizedScroll } from './timeline.mjs';

/** Mounts both the DOM story and the optional GPU renderer. Returns full cleanup. */
export function mountExperience(root) {
  const abort = new AbortController();
  const signal = abort.signal;
  const $ = (selector) => root.querySelector(selector);
  const $$ = (selector) => [...root.querySelectorAll(selector)];
  const track = $('.assembly-track');
  const intro = $('[data-intro]');
  const story = $('[data-story]');
  const meter = $('[data-meter]');
  const status = $('[data-status]');
  const controls = $('[data-reveal-controls]');
  const dialog = $('[data-credits]');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let storedMotion;
  try { storedMotion = localStorage.getItem('revuelto-motion'); } catch {}
  let reduced = storedMotion ? storedMotion === 'reduced' : media.matches;
  let engine, destroyed = false, ready = false, engineError = false;
  let current = reduced ? 1 : 0, currentChapter = -1, lastPercent = -1;
  let inspecting = false, exploded = false, lights = true;
  let gsap, ScrollTrigger, scrollTween, scrollTrigger;
  let frame = 0, lastFocus;
  root.dataset.motion = reduced ? 'reduced' : 'full';

  function announce(text) { $('[data-announcement]').textContent = text; }
  function setStatus(text) { if (status.textContent !== text) status.textContent = text; }
  function stateStatus() {
    if (!ready || engineError) return;
    setStatus(current > .965 ? 'Assembly complete. Make it your own.' : current < .08 ? 'Scroll down to assemble. Scroll up to reverse.' : 'Scroll down to build · up to reverse.');
  }
  function setInspect(value) {
    inspecting = !!value && ready && current >= .965;
    engine?.setInspect(inspecting);
    root.dataset.inspect = String(inspecting);
    $('[data-action="inspect"]').setAttribute('aria-pressed', String(inspecting));
    $('[data-inspect-hint]').hidden = !inspecting;
    if (inspecting) announce('Inspection enabled. Drag to rotate. Focus the canvas and use arrow keys to rotate or zoom. Escape exits.');
  }
  function setExplode(value) {
    exploded = !!value && ready && current >= .965;
    engine?.setExploded(exploded);
    $('[data-action="explode"]').setAttribute('aria-pressed', String(exploded));
  }
  function update(progress) {
    if (destroyed) return;
    current = reduced ? 1 : clamp01(progress);
    const index = chapterIndex(current);
    const percent = Math.round(current * 100);
    root.style.setProperty('--progress', String(current));
    intro.style.opacity = String(1 - interval(current, .018, .102));
    intro.style.transform = `translateY(${-interval(current, .01, .11) * 45}px)`;
    intro.style.pointerEvents = current >= .095 ? 'none' : '';
    intro.inert = current >= .095;
    intro.setAttribute('aria-hidden', String(current >= .095));
    const storyVisible = current >= CHAPTERS[1].at;
    story.style.opacity = storyVisible ? '1' : '0';
    story.setAttribute('aria-hidden', String(!storyVisible));
    if (index !== currentChapter) {
      currentChapter = index;
      root.dataset.phase = String(index);
      const chapter = CHAPTERS[index];
      $('[data-kicker]').textContent = chapter.kicker;
      $('[data-title]').innerHTML = chapter.title;
      $('[data-description]').innerHTML = chapter.text;
      $('[data-chapter-label]').textContent = chapter.label.toUpperCase();
      $$('.chapter-dot').forEach((button, i) => {
        button.classList.toggle('is-active', i === index);
        if (i === index) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
      });
      announce(chapter.kicker);
      stateStatus();
    }
    if (percent !== lastPercent) {
      lastPercent = percent;
      $('[data-percent]').textContent = String(percent).padStart(2, '0');
      $('[data-meter-fill]').style.transform = `scaleX(${current})`;
      meter.setAttribute('aria-valuenow', String(percent));
    }
    const finished = current >= .965;
    controls.hidden = !finished;
    $$('.stage-actions [data-action="reveal"]').forEach((button) => { button.hidden = finished; });
    $$('.stage-actions [data-action="replay"]').forEach((button) => { button.hidden = !finished; });
    if (!finished && inspecting) setInspect(false);
    if (!finished && exploded) setExplode(false);
    engine?.setProgress(current);
  }
  function geometry() {
    const rect = track.getBoundingClientRect();
    return { top: rect.top + scrollY, height: rect.height, viewport: innerHeight };
  }
  function updateFromScroll() {
    frame = 0;
    if (destroyed || scrollTrigger || reduced) return;
    const { top, height, viewport } = geometry();
    update(normalizedScroll(scrollY, top, height, viewport));
  }
  function requestUpdate() {
    if (!frame && !destroyed && !scrollTrigger) frame = requestAnimationFrame(updateFromScroll);
  }
  function jump(progress, immediate = false) {
    setInspect(false); setExplode(false);
    if (reduced && progress < .93) {
      setMotion(false, true);
      requestAnimationFrame(() => jump(progress, immediate));
      return;
    }
    const { top, height, viewport } = geometry();
    window.scrollTo({ top: top + clamp01(progress) * Math.max(0, height - viewport), behavior: reduced || immediate ? 'instant' : 'smooth' });
    if (immediate || reduced) { scrollTrigger?.update(); requestUpdate(); }
  }
  function installScroll() {
    scrollTrigger?.kill(); scrollTween?.kill(); scrollTrigger = scrollTween = undefined;
    if (reduced) { update(1); return; }
    if (gsap && ScrollTrigger) {
      const proxy = { value: 0 };
      scrollTween = gsap.fromTo(proxy, { value: 0 }, {
        value: 1, duration: 1, ease: 'none',
        onUpdate: () => update(proxy.value),
        scrollTrigger: { trigger: track, start: 'top top', end: 'bottom bottom', scrub: .55, invalidateOnRefresh: true }
      });
      scrollTrigger = scrollTween.scrollTrigger;
      ScrollTrigger.refresh(); scrollTrigger.update();
    } else updateFromScroll();
  }
  function setMotion(value, persist = false) {
    reduced = value;
    root.dataset.motion = reduced ? 'reduced' : 'full';
    $('[data-motion-label]').textContent = reduced ? 'REDUCED' : 'FULL';
    $('[data-action="motion"]').setAttribute('aria-pressed', String(reduced));
    $('[data-reduced-notice]').hidden = !reduced || engineError;
    if (persist) { storedMotion = reduced ? 'reduced' : 'full'; try { localStorage.setItem('revuelto-motion', storedMotion); } catch {} }
    setInspect(false); setExplode(false);
    engine?.setReduced(reduced);
    installScroll();
    requestAnimationFrame(() => { if (!destroyed) { ScrollTrigger?.refresh(); requestUpdate(); } });
  }
  function fail(error) {
    if (destroyed) return;
    ready = false; engineError = true; root.dataset.engine = 'error';
    $('[data-load-error]').hidden = false;
    $('[data-reduced-notice]').hidden = true;
    $('[data-error-message]').textContent = '3D could not load. You can still explore the design below.';
    setStatus('3D unavailable · design story available.');
    $$('[data-finish], [data-action="inspect"], [data-action="explode"], [data-action="lights"]').forEach((button) => { button.disabled = true; });
    engine?.dispose();
    console.warn('[Revuelto] 3D initialization failed:', error);
  }
  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-action], [data-jump], [data-finish]') : null;
    if (!target || !root.contains(target) || target.disabled) return;
    event.preventDefault();
    if (target.hasAttribute('data-jump')) { jump(Number(target.dataset.jump)); return; }
    if (target.hasAttribute('data-finish')) {
      if (!ready) return;
      const finish = FINISHES.find((item) => item.id === target.dataset.finish);
      if (!finish) return;
      engine.setFinish(finish.id); root.style.setProperty('--accent', finish.accent);
      $$('[data-finish]').forEach((button) => {
        const active = button.dataset.finish === finish.id;
        button.setAttribute('aria-pressed', String(active)); button.classList.toggle('is-selected', active);
      });
      $('[data-finish-name]').textContent = finish.name;
      announce(`Presentation finish: ${finish.name}.`); return;
    }
    switch (target.dataset.action) {
      case 'reveal': jump(1); break;
      case 'replay': jump(0); break;
      case 'motion': {
        const top = geometry().top;
        setMotion(!reduced, true); window.scrollTo({ top, behavior: 'instant' });
        break;
      }
      case 'inspect': setInspect(!inspecting); break;
      case 'explode': setExplode(!exploded); break;
      case 'lights': lights = !lights; engine?.setLights(lights); target.setAttribute('aria-pressed', String(lights)); break;
      case 'credits': lastFocus = target; if (!dialog.open) dialog.showModal(); break;
      case 'close-credits': dialog.close(); break;
      case 'retry': location.reload(); break;
    }
  }, { signal });
  dialog.addEventListener('close', () => lastFocus?.focus({ preventScroll: true }), { signal });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }, { signal });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && inspecting) setInspect(false); }, { signal });
  media.addEventListener('change', () => { if (!storedMotion) setMotion(media.matches); }, { signal });
  window.addEventListener('scroll', requestUpdate, { passive: true, signal });
  window.addEventListener('resize', requestUpdate, { passive: true, signal });
  window.addEventListener('pageshow', () => { ScrollTrigger?.refresh(); requestUpdate(); }, { signal });
  const resizeObserver = new ResizeObserver(() => { ScrollTrigger?.refresh(); requestUpdate(); });
  resizeObserver.observe(track);
  $$('[data-finish]').forEach((button) => { button.disabled = true; });
  setMotion(reduced);
  update(reduced ? 1 : current);

  import('./engine.mjs').then(({ AssemblyEngine }) => {
    if (destroyed) return;
    engine = new AssemblyEngine($('[data-canvas-host]'), {
      reduced,
      onStatus: (text) => { if (!destroyed) setStatus(text); },
      onReady: () => {
        if (destroyed) return;
        ready = true; engineError = false; root.dataset.engine = 'ready';
        $('[data-load-error]').hidden = true;
        $('[data-reduced-notice]').hidden = !reduced;
        $$('[data-finish], [data-action="inspect"], [data-action="explode"], [data-action="lights"]').forEach((button) => { button.disabled = false; });
        engine?.setProgress(current); stateStatus();
      },
      onError: fail,
      onExitInspect: () => setInspect(false)
    });
    engine.setProgress(current);
  }).catch(fail);
  Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([core, plugin]) => {
    if (destroyed) return;
    gsap = core.gsap || core.default;
    ScrollTrigger = plugin.ScrollTrigger || plugin.default;
    gsap.registerPlugin(ScrollTrigger); installScroll();
  }).catch(() => { /* Native scroll mapping remains active if the enhancement cannot load. */ });

  if (new URLSearchParams(location.search).has('debug') || root.hasAttribute('data-debug')) {
    window.__REVUELTO__ = {
      getState: () => ({ progress: current, chapter: currentChapter, reduced, ready, engineError, inspect: inspecting, ...engine?.getState() }),
      seek: (progress) => jump(progress, true)
    };
  }
  return () => {
    destroyed = true; abort.abort(); cancelAnimationFrame(frame);
    resizeObserver.disconnect(); scrollTrigger?.kill(); scrollTween?.kill();
    engine?.dispose(); if (dialog.open) dialog.close();
    if (window.__REVUELTO__) delete window.__REVUELTO__;
  };
}
