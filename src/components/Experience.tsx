'use client';
import { useShowroom } from '../hooks/useShowroom';
import { FINISHES } from '../lib/config.mjs';
import { isQuality } from '../lib/showroom/state';
import { AssemblyStory } from './showroom/AssemblyStory';
import { HotspotLayer } from './showroom/DetailExplorer';
import { ModeNavigation } from './showroom/ModeNavigation';
import { CabinControls } from './showroom/CabinControls';
import { CreditsDialog } from './showroom/CreditsDialog';
import { Editorial, Footer } from './showroom/Editorial';
import { ActionButton, Brand, Icon } from './showroom/ui';
import type { CSSProperties } from 'react';

/** One stable canvas; declarative React owns every visible control and its state. */
export default function Experience() {
  const { state, send, root, track, host, cabinOverlay, interiorLauncher } = useShowroom();
  const cabinActive = state.cabin.mode !== 'exterior';
  const inert = cabinActive || state.cleanView;
  const fallback = state.engine === 'error' || state.engine === 'deferred';
  const accent = FINISHES.find(finish => finish.id === state.finish)?.accent;
  return <div ref={root} className="experience" data-ui="react" data-engine={state.engine} data-phase={state.chapter} data-motion={state.reduced ? 'reduced' : 'full'}
    data-quality={state.quality} data-inspect={state.inspecting} data-cabin={state.cabin.mode} data-mode={state.mode} data-clean={state.cleanView} data-fonts-ready={state.fontsReady} data-detail={state.activeDetail || 'none'} data-hotspots={state.hotspotsEnabled && state.mode === 'explore' && state.finished}
    style={{ '--accent': accent } as CSSProperties}>
    <a className="skip-link" href="#design" inert={inert}>Skip animation and explore the design</a>
    <header className="site-header" inert={inert}><a className="brand" href="#" onClick={event => { event.preventDefault(); send({ type: 'replay' }); }} aria-label="Revuelto experience, back to beginning"><Brand/></a>
      <nav className="header-nav" aria-label="Main navigation"><a href="#assembly" onClick={event => { event.preventDefault(); send({ type: 'jump', progress: .12 }); }}>THE ASSEMBLY</a><a href="#design">THE DESIGN</a><ActionButton action="reveal" send={send} className="nav-explore">EXPLORE THE CAR <Icon/></ActionButton></nav>
    </header>
    <main><section ref={track} className="assembly-track" id="assembly" aria-label="Scroll-driven Revuelto assembly"><div className="stage">
      <div className="stage-atmosphere" aria-hidden="true"><div className="wall-light wall-light-one"/><div className="wall-light wall-light-two"/><div className="horizon"/><div className="floor-lines"/></div>
      <div ref={host} className="canvas-host" data-canvas-host aria-label="Interactive 3D showroom"><HotspotLayer state={state} send={send}/></div>
      <div className="fallback-image" aria-hidden="true">{fallback && <><img src="/images/reference.webp" alt="" decoding="async" width={1440} height={810}/><span>STATIC VISUAL REFERENCE · 3D UNAVAILABLE</span></>}</div>
      <div className="stage-vignette" aria-hidden="true"/>
      <span className="edition-tag" aria-hidden="true">FORM / PRECISION / EMOTION</span><span className="stage-wordmark" aria-hidden="true">REVUELTO</span>
      <label className="quality-control" inert={inert}>RENDER <select data-quality aria-label="Rendering quality" value={state.quality} onChange={event => { if (isQuality(event.target.value)) send({ type: 'quality', quality: event.target.value }); }}><option value="auto">AUTO</option><option value="high">HIGH</option><option value="eco">ECO</option></select></label>
      <div className="scene-coordinate mono" aria-hidden="true"><span>ATELIER / 001</span><span>SANT’AGATA BOLOGNESE, ITALY</span></div>
      <AssemblyStory state={state} send={send}/>
      <ModeNavigation state={state} send={send} interiorLauncher={interiorLauncher}/>
      <CabinControls state={state} send={send} overlayRef={cabinOverlay}/>
      <div className="inspect-hint" data-inspect-hint hidden={!state.inspecting || cabinActive || state.cleanView}>DRAG TO ROTATE <span>·</span> ARROW KEYS TO ADJUST <span>·</span> ESC TO EXIT</div>
      <button type="button" className="restore-interface control-button" data-restore-ui hidden={!state.cleanView} onClick={() => send({ type: 'clean-photo' })}><Icon name="close"/> SHOW CONTROLS <small>ESC</small></button>
      <div className="load-error" data-load-error hidden={!fallback}><span data-error-message>{state.engine === 'deferred' ? 'Data Saver is on. The 3D download is paused.' : '3D could not load. You can still explore the design below.'}</span><ActionButton action="retry" send={send}>{state.engine === 'deferred' ? 'ENABLE 3D' : 'RETRY 3D'}<Icon name="replay"/></ActionButton></div>
      <div className="reduced-notice" data-reduced-notice hidden={!state.reduced || state.engine === 'error'}>REDUCED MOTION · SHOWING THE ASSEMBLED CAR</div>
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-announcement>{state.announcement}</div>
    </div></section>
      <div inert={cabinActive || state.cleanView}><Editorial send={send}/></div>
    </main>
    <div inert={cabinActive || state.cleanView}><Footer send={send}/></div>
    <CreditsDialog state={state} send={send}/>
    <noscript><div className="noscript-note">The interactive assembly requires JavaScript. The design story and model credits remain available below.</div></noscript>
  </div>;
}
