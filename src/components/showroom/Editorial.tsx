import { memo } from 'react';
import { MODEL } from '../../lib/config.mjs';
import type { Action } from '../../lib/showroom/state';
import { ActionButton, Icon } from './ui';
/** Static story content never receives animation state. */
export const Editorial = memo(function Editorial({ send }: { send(action: Action): void }) {
  return <>
    <section className="specifications" data-editorial aria-label="Manufacturer's published Revuelto specifications">
      <div className="spec-intro"><p className="eyebrow">LAMBORGHINI REVUELTO</p><h2>A DIFFERENT<br/>KIND OF <em>POWER.</em></h2></div>
      <dl className="spec-grid"><div><dt>COMBINED POWER</dt><dd>1,015<small>CV</small></dd></div><div><dt>0–100 KM/H</dt><dd>2.5<small>SECONDS</small></dd></div><div><dt>MAXIMUM SPEED</dt><dd>&gt;350<small>KM/H</small></dd></div></dl>
      <a className="spec-source" href={MODEL.official} target="_blank" rel="noopener noreferrer">Manufacturer specifications <Icon/></a>
    </section>
    <section className="design-section" id="design" aria-labelledby="design-title">
      <div className="design-heading" data-editorial><div><p className="eyebrow"><span className="red-rule"/>THE DESIGN DNA</p><h2 id="design-title">NOT MADE<br/>TO <span className="outline">BLEND IN.</span></h2></div><p>Recognisable before you see the badge. Sharp lines. Deep contrasts. An unmistakable presence, from the first detail to the final silhouette.</p></div>
      <figure className="design-image" data-editorial><img src="/images/reference.webp" alt="Supplied visual reference: a red and black Lamborghini with sculpted bodywork in a concrete showroom" loading="lazy" decoding="async" width={1440} height={810} srcSet="/images/reference-640.webp 640w, /images/reference-960.webp 960w, /images/reference.webp 1440w" sizes="(max-width: 760px) 100vw, 86vw"/>
        <figcaption><span>ROSSO / CARBON — VISUAL DIRECTION</span><span>REFERENCE IMAGE · CUSTOM BODYWORK</span></figcaption></figure>
      <div className="design-notes"><article data-editorial><span className="note-number">01 /</span><h3>SCULPTED, NOT DECORATED.</h3><p>Sculpted red surfaces meet deep carbon tones. A deliberate contrast, inspired by your chosen visual reference.</p></article>
        <article data-editorial><span className="note-number">02 /</span><h3>EVERY DETAIL, A PURPOSE.</h3><p>Explore the model’s real component geometry. Scroll forward to build, or backward to take it apart.</p></article>
        <article data-editorial><span className="note-number">03 /</span><h3>YOUR PERSPECTIVE.</h3><p>Step out of the cinematic camera path. Inspect the assembled car, change its finish, and explore its parts.</p></article></div>
    </section>
    <section className="closing" data-editorial><p className="eyebrow">NOTHING EXTRAORDINARY HAPPENS BY ACCIDENT.</p><h2>EXPERIENCE IT.<br/><span className="outline">ALL OVER AGAIN.</span></h2><ActionButton action="replay" send={send} className="primary-button">BACK TO THE BEGINNING <Icon name="replay"/></ActionButton></section>
  </>;
});
export function Footer({ send }: { send(action: Action): void }) {
  return <footer><div className="footer-top"><span className="footer-wordmark">REVUELTO<span> / ATELIER</span></span><ActionButton action="credits" send={send} className="text-button">PROJECT &amp; MODEL CREDITS <Icon/></ActionButton></div>
    <div className="footer-bottom"><p>Independent fan-made concept. Not affiliated with or endorsed by Automobili Lamborghini.</p><p>3D model: <a href={MODEL.source} target="_blank" rel="noopener noreferrer">ALIEEEN</a> · <a href={MODEL.licenseUrl} target="_blank" rel="noopener noreferrer">CC BY 4.0</a><br/>Materials, scene, and animation modified.</p></div></footer>;
}
