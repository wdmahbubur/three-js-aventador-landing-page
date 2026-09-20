import { MODEL, FINISHES, CHAPTERS } from './config.mjs';
const arrow = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
const down = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v15m-6-6 6 6 6-6"/></svg>';
const replay = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10a8 8 0 1 1 .8 7M4 4v6h6"/></svg>';
const orbit = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-30 12 12)"/><circle cx="12" cy="12" r="3"/></svg>';
const light = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 6c-6 0-8 3-8 6s2 6 8 6V6Zm4 1h4m-4 5h4m-4 5h4"/></svg>';
const explode = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5"/></svg>';
const close = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg>';
const mark = '<svg class="brand-mark" viewBox="0 0 44 50" fill="none" aria-hidden="true"><path d="M3 3h38v25L22 47 3 28V3Z"/><path d="M13 14h10c6 0 8 8 2 11l7 10h-7l-7-10h-1v10h-5V14Z"/></svg>';

export function pageMarkup() {
  return `
    <a class="skip-link" href="#design">Skip animation and explore the design</a>
    <header class="site-header">
      <a class="brand" href="#" data-action="replay" aria-label="Revuelto experience, back to beginning">${mark}<span>LAMBORGHINI<small>REVUELTO · ASSEMBLY EXPERIENCE</small></span></a>
      <nav class="header-nav" aria-label="Main navigation"><a href="#assembly" data-jump=".12">THE ASSEMBLY</a><a href="#design">THE DESIGN</a><button class="nav-explore" type="button" data-action="reveal">EXPLORE THE CAR ${arrow}</button></nav>
    </header>
    <main>
      <section class="assembly-track" id="assembly" aria-label="Scroll-driven Revuelto assembly">
        <div class="stage">
          <div class="stage-atmosphere" aria-hidden="true"><div class="wall-light wall-light-one"></div><div class="wall-light wall-light-two"></div><div class="horizon"></div><div class="floor-lines"></div></div>
          <div class="canvas-host" data-canvas-host aria-label="Interactive 3D showroom"></div>
          <div class="fallback-image" aria-hidden="true"><img data-fallback-src="/images/reference.webp" decoding="async" alt="" width="1440" height="810"/><span>STATIC VISUAL REFERENCE · 3D UNAVAILABLE</span></div>
          <div class="stage-vignette" aria-hidden="true"></div>
          <span class="edition-tag" aria-hidden="true">FORM / PRECISION / EMOTION</span>
          <span class="stage-wordmark" aria-hidden="true">REVUELTO</span>
          <label class="quality-control">RENDER <select data-quality aria-label="Rendering quality"><option value="auto">AUTO</option><option value="high">HIGH</option><option value="eco">ECO</option></select></label>
          <div class="scene-coordinate mono" aria-hidden="true"><span>ATELIER / 001</span><span>SANT’AGATA BOLOGNESE, ITALY</span></div>
          <div class="hero-copy" data-intro>
            <p class="eyebrow"><span class="live-dot"></span> AN EXPLORATION IN PRECISION</p>
            <h1>${CHAPTERS[0].title}</h1>
            <p class="intro-description">${CHAPTERS[0].text}</p>
            <button class="begin-button" type="button" data-jump=".12"><span class="hex-button">${down}</span><span>SCROLL TO ASSEMBLE<small>YOU SET THE PACE.</small></span></button>
          </div>
          <div class="chapter-copy" data-story aria-hidden="true"><p class="eyebrow" data-kicker></p><h2 data-title></h2><p class="chapter-description" data-description></p></div>
          <nav class="chapter-rail" aria-label="Assembly chapters">${CHAPTERS.map((chapter, i) => `<button type="button" class="chapter-dot${i === 0 ? ' is-active' : ''}" data-jump="${chapter.at === .93 ? 1 : chapter.at + (i ? .015 : 0)}" data-chapter="${i}" aria-label="${chapter.kicker}" ${i === 0 ? 'aria-current="step"' : ''}><span class="rail-label">${chapter.label}</span><span class="dot"></span></button>`).join('')}</nav>
          <div class="reveal-controls" data-reveal-controls hidden>
            <div class="finish-picker" role="group" aria-label="Presentation paint finish"><span class="control-caption">FINISH</span>${FINISHES.map((finish, i) => `<button type="button" class="swatch${i === 0 ? ' is-selected' : ''}" style="--swatch:${finish.color}" data-finish="${finish.id}" aria-label="${finish.name}" aria-pressed="${i === 0}"><span></span></button>`).join('')}<span class="finish-name" data-finish-name>${FINISHES[0].name}</span></div>
            <div class="view-controls"><button class="control-button" type="button" data-action="inspect" aria-pressed="false" disabled>${orbit}<span>INSPECT 360°</span></button><button class="control-button" type="button" data-action="explode" aria-pressed="false" disabled>${explode}<span>EXPLODED VIEW</span></button><button class="icon-button" type="button" data-action="lights" aria-pressed="true" aria-label="Headlights" title="Toggle headlights" disabled>${light}</button></div>
          </div>
          <div class="inspect-hint" data-inspect-hint hidden>DRAG TO ROTATE <span>·</span> PINCH TO ZOOM <span>·</span> ESC TO EXIT</div>
          <div class="stage-bottom"><div class="assembly-meter"><div class="meter-heading mono"><span data-chapter-label>THE BEGINNING</span><span><strong data-percent>00</strong><span class="percent-symbol">%</span></span></div><div class="meter-track" role="progressbar" aria-label="Assembly progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-meter><span data-meter-fill></span></div><p class="status-line" data-status role="status">Preparing the interactive showroom…</p></div><div class="stage-actions"><button type="button" class="text-button" data-action="reveal">SKIP TO REVEAL ${arrow}</button><button type="button" class="text-button" data-action="replay" hidden>${replay} REPLAY ASSEMBLY</button><button type="button" class="motion-button" data-action="motion" aria-pressed="false">MOTION <span data-motion-label>FULL</span></button></div></div>
          <div class="load-error" data-load-error hidden><span data-error-message>3D could not load. The design story is still available below.</span><button type="button" data-action="retry">RETRY 3D ${replay}</button></div>
          <div class="reduced-notice" data-reduced-notice hidden>REDUCED MOTION · SHOWING THE ASSEMBLED CAR</div>
          <div class="sr-only" aria-live="polite" aria-atomic="true" data-announcement></div>
        </div>
      </section>
      <section class="specifications" data-editorial aria-label="Manufacturer's published Revuelto specifications"><div class="spec-intro"><p class="eyebrow">LAMBORGHINI REVUELTO</p><h2>A DIFFERENT<br>KIND OF <em>POWER.</em></h2></div><dl class="spec-grid"><div><dt>COMBINED POWER</dt><dd>1,015<small>CV</small></dd></div><div><dt>0–100 KM/H</dt><dd>2.5<small>SECONDS</small></dd></div><div><dt>MAXIMUM SPEED</dt><dd>&gt;350<small>KM/H</small></dd></div></dl><a class="spec-source" href="${MODEL.official}" target="_blank" rel="noopener noreferrer">Manufacturer specifications ${arrow}</a></section>
      <section class="design-section" id="design" aria-labelledby="design-title"><div class="design-heading" data-editorial><div><p class="eyebrow"><span class="red-rule"></span> THE DESIGN DNA</p><h2 id="design-title">NOT MADE<br>TO <span class="outline">BLEND IN.</span></h2></div><p>Recognisable before you see the badge. Sharp lines. Deep contrasts. An unmistakable presence, from the first detail to the final silhouette.</p></div><figure class="design-image" data-editorial><img src="/images/reference.webp" alt="Supplied visual reference: a red and black Lamborghini with sculpted bodywork in a concrete showroom" loading="lazy" decoding="async" width="1440" height="810" srcset="/images/reference-640.webp 640w, /images/reference-960.webp 960w, /images/reference.webp 1440w" sizes="(max-width: 760px) 100vw, 86vw"/><figcaption><span>ROSSO / CARBON — VISUAL DIRECTION</span><span>REFERENCE IMAGE · CUSTOM BODYWORK</span></figcaption></figure><div class="design-notes"><article data-editorial><span class="note-number">01 /</span><h3>SCULPTED, NOT DECORATED.</h3><p>Sculpted red surfaces meet deep carbon tones. A deliberate contrast, inspired by your chosen visual reference.</p></article><article data-editorial><span class="note-number">02 /</span><h3>EVERY DETAIL, A PURPOSE.</h3><p>Explore the free model’s real component geometry. Scroll forward to build, or backward to take it apart.</p></article><article data-editorial><span class="note-number">03 /</span><h3>YOUR PERSPECTIVE.</h3><p>Step out of the cinematic camera path. Inspect the assembled car, change its finish, and explore its parts.</p></article></div></section>
      <section class="closing" data-editorial><p class="eyebrow">NOTHING EXTRAORDINARY HAPPENS BY ACCIDENT.</p><h2>EXPERIENCE IT.<br><span class="outline">ALL OVER AGAIN.</span></h2><button type="button" class="primary-button" data-action="replay">BACK TO THE BEGINNING ${replay}</button></section>
    </main>
    <footer><div class="footer-top"><span class="footer-wordmark">REVUELTO<span> / ASSEMBLY</span></span><button class="text-button" type="button" data-action="credits">PROJECT & MODEL CREDITS ${arrow}</button></div><div class="footer-bottom"><p>Independent fan-made concept. Not affiliated with or endorsed by Automobili Lamborghini.</p><p>3D model: <a href="${MODEL.source}" target="_blank" rel="noopener noreferrer">ALIEEEN</a> · <a href="${MODEL.licenseUrl}" target="_blank" rel="noopener noreferrer">CC BY 4.0</a><br>Materials, scene, and animation modified.</p></div></footer>
    <dialog class="credits-dialog" data-credits aria-labelledby="credits-title"><div class="dialog-top"><p class="eyebrow">BEHIND THE EXPERIENCE</p><button class="icon-button" type="button" data-action="close-credits" aria-label="Close credits">${close}</button></div><h2 id="credits-title">BUILT IN THE OPEN.</h2><p>This independent concept uses <a href="${MODEL.source}" target="_blank" rel="noopener noreferrer">“${MODEL.title}”</a> by <a href="${MODEL.authorUrl}" target="_blank" rel="noopener noreferrer">${MODEL.author}</a>, licensed under <a href="${MODEL.licenseUrl}" target="_blank" rel="noopener noreferrer">${MODEL.license}</a>.</p><p>Modifications: red/black presentation materials, part grouping and pivots, cinematic assembly, studio lighting, and an illustrative support frame. This is not a factory assembly simulation.</p><p>The interactive asset is a standard Revuelto model. The supplied reference image shows different, custom bodywork; its exact body kit is not reproduced.</p><p>Built with Next.js, Three.js, and GSAP. No paid 3D assets, accounts, or API keys are required.</p><a class="dialog-link" href="${MODEL.official}" target="_blank" rel="noopener noreferrer">Explore the official Lamborghini Revuelto ${arrow}</a></dialog>
    <noscript><div class="noscript-note">JavaScript is disabled. The interactive assembly requires JavaScript; the design and model credits remain available below.</div></noscript>
  `;
}
