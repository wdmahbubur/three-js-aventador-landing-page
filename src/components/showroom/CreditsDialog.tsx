import { useEffect, useRef } from 'react';
import { MODEL } from '../../lib/config.mjs';
import { ActionButton, Icon, type UIProps } from './ui';
export function CreditsDialog({ state, send }: UIProps) {
  const dialog = useRef<HTMLDialogElement>(null), previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!dialog.current) return;
    if (state.creditsOpen && !dialog.current.open) {
      previousFocus.current = document.activeElement as HTMLElement;
      dialog.current.showModal();
    } else if (!state.creditsOpen && dialog.current.open) {
      dialog.current.close(); previousFocus.current?.focus({ preventScroll: true });
    }
  }, [state.creditsOpen]);
  return <dialog ref={dialog} className="credits-dialog" data-credits aria-labelledby="credits-title" onClose={() => {
    send({ type: 'close-credits' }); previousFocus.current?.focus({ preventScroll: true });
  }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) send({ type: 'close-credits' });
  }}>
    <div className="dialog-top"><p className="eyebrow">BEHIND THE EXPERIENCE</p><ActionButton action="close-credits" send={send} className="icon-button" aria-label="Close credits"><Icon name="close"/></ActionButton></div>
    <h2 id="credits-title">BUILT IN THE OPEN.</h2>
    <p>This independent concept uses <a href={MODEL.source} target="_blank" rel="noopener noreferrer">“{MODEL.title}”</a> by <a href={MODEL.authorUrl} target="_blank" rel="noopener noreferrer">{MODEL.author}</a>, licensed under <a href={MODEL.licenseUrl} target="_blank" rel="noopener noreferrer">{MODEL.license}</a>.</p>
    <p>Modifications: presentation materials, component grouping and pivots, cinematic assembly, opening doors, first-person camera, studio lighting and an illustrative support frame. This is not a factory assembly simulation.</p>
    <p>The interactive asset is a standard Revuelto model. The supplied reference image shows different, custom bodywork; its exact body kit is not reproduced.</p>
    <p>Built with Next.js, React, TypeScript, Three.js and GSAP. No paid 3D assets, accounts, or API keys are required.</p>
    <a className="dialog-link" href={MODEL.official} target="_blank" rel="noopener noreferrer">Explore the official Lamborghini Revuelto <Icon/></a>
  </dialog>;
}
