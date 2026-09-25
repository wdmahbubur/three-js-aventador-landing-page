import { useEffect, useRef } from 'react';
import { DETAILS } from '../../lib/details.mjs';
import type { DetailId } from '../../lib/showroom/state';
import { ActionButton, Icon, type UIProps } from './ui';

export function DetailExplorer({state,send}: UIProps) {
  const selected = DETAILS.find(detail => detail.id === state.activeDetail);
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!selected) return;
    const frame = requestAnimationFrame(() => {
      const panel = card.current?.closest<HTMLElement>('.workspace-panel');
      if (panel && card.current) panel.scrollTop += card.current.getBoundingClientRect().top - panel.getBoundingClientRect().top - 12;
    });
    return () => cancelAnimationFrame(frame);
  }, [selected?.id]);
  const disabled = state.engine !== 'ready' || state.exploded;
  return <div className="detail-explorer">
    <div className="detail-menu-heading"><span>EXPLORE THE DETAILS</span><ActionButton action="toggle-hotspots" send={send} className="text-button" aria-pressed={state.hotspotsEnabled}>{state.hotspotsEnabled ? 'HIDE' : 'SHOW'} MARKERS</ActionButton></div>
    <div className="detail-menu" role="group" aria-label="Explore car details">
      {DETAILS.map(detail => <button key={detail.id} type="button" data-detail-select={detail.id} disabled={disabled}
        aria-pressed={state.activeDetail === detail.id} onClick={() => send({type:'detail',id:detail.id as DetailId})}><small>{detail.number}</small>{detail.label}<Icon/></button>)}
    </div>
    {selected && <article ref={card} className="detail-card" aria-labelledby="detail-title" data-detail-card={selected.id}>
      <div className="detail-card-heading"><span>DETAIL / {selected.number}</span><ActionButton action="clear-detail" send={send} className="icon-button" aria-label="Close detail view"><Icon name="close"/></ActionButton></div>
      <h3 id="detail-title">{selected.title}</h3><p>{selected.text}</p>
      {selected.action === 'customize-wheels' ? <button type="button" className="control-button" data-action="detail-customize-wheels" onClick={() => {send({type:'mode',mode:'customize'});send({type:'config-section',section:'wheels'});}}>CUSTOMIZE WHEELS <Icon/></button> :
        selected.action === 'interior' ? <button type="button" className="control-button" data-action="detail-interior" onClick={event => {
          // The detail card unmounts on entry. Save a stable, visible return target instead.
          const panel = event.currentTarget.closest<HTMLElement>('.workspace-panel');
          const launcher = panel?.querySelector<HTMLButtonElement>('[data-action="interior"]');
          if (panel && launcher) { panel.scrollTop = 0; launcher.focus({ preventScroll: true }); }
          send({ type: 'interior' });
        }}>ENTER INTERIOR <Icon/></button> :
        selected.action && <ActionButton action={selected.action as 'doors' | 'lights'} send={send}>{selected.actionLabel} <Icon/></ActionButton>}
    </article>}
  </div>;
}
export function HotspotLayer({state,send}: UIProps) {
  const enabled = state.engine === 'ready' && state.finished && state.mode === 'explore' && state.cabin.mode === 'exterior' && !state.cleanView && !state.exploded && state.hotspotsEnabled;
  return <div className="hotspot-layer" data-hotspot-layer hidden={!enabled} aria-label="Vehicle landmarks">
    {DETAILS.map(detail => <button key={detail.id} type="button" className="hotspot" data-hotspot={detail.id}
      aria-label={`Explore ${detail.label}`} aria-pressed={state.activeDetail === detail.id}
      onClick={() => send({type:'detail',id:detail.id as DetailId})}><span>{detail.number}</span><small style={{ pointerEvents: 'none' }}>{detail.label}</small></button>)}
  </div>;
}
