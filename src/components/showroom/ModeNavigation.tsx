import { useRef, type RefObject } from 'react';
import { ConfiguratorPanel } from './ConfiguratorPanel';
import { DetailExplorer } from './DetailExplorer';
import { MODES, modeAtKey, type Mode } from '../../lib/showroom/state';
import { ActionButton, Icon, type UIProps } from './ui';

export function ModeNavigation({ state, send, interiorLauncher }: UIProps & { interiorLauncher: RefObject<HTMLButtonElement | null> }) {
  const tabs = useRef<Partial<Record<Mode, HTMLButtonElement | null>>>({});
  const activeCabin = state.cabin.mode !== 'exterior';
  const available = state.engine === 'ready';
  const doorReady = available && state.cabin.available && !state.exploded;
  return <section className="showroom-workspace reveal-controls" data-reveal-controls hidden={!state.finished} inert={activeCabin || state.cleanView} aria-label="Showroom workspace">
    <div className="workspace-tabs" role="tablist" aria-label="Showroom modes">
      {MODES.map((mode, index) => <button key={mode} type="button" role="tab" id={`tab-${mode}`} aria-controls={`panel-${mode}`} aria-selected={state.mode === mode}
        tabIndex={state.mode === mode ? 0 : -1} data-mode-tab={mode} ref={node => { tabs.current[mode] = node; }}
        onClick={() => send({ type: 'mode', mode })} onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault(); const next = modeAtKey(mode, event.key);
          send({ type: 'mode', mode: next }); tabs.current[next]?.focus({ preventScroll: true });
        }}><span className="tab-index">0{index + 1}</span>{mode === 'photo' ? 'Photo' : mode === 'customize' ? 'Customize' : 'Explore'}</button>)}
    </div>
    <div className="workspace-panel" role="tabpanel" id="panel-explore" aria-labelledby="tab-explore" hidden={state.mode !== 'explore'} tabIndex={0}>
      <div className="workspace-caption"><span>MAKE IT YOUR PERSPECTIVE.</span><small>Walk around. Open the doors. Take a seat.</small></div>
      <div className="workspace-actions">
        <ActionButton action="inspect" send={send} disabled={!available} aria-pressed={state.inspecting}><Icon name="orbit"/><span>INSPECT 360°</span></ActionButton>
        <ActionButton action="explode" send={send} disabled={!available} aria-pressed={state.exploded}><Icon name="layers"/><span>EXPLODED VIEW</span></ActionButton>
        <ActionButton action="doors" send={send} disabled={!doorReady} aria-pressed={state.cabin.doorsOpen}><Icon name="door"/><span data-door-label>{state.cabin.doorsOpen ? 'CLOSE DOORS' : 'OPEN DOORS'}</span></ActionButton>
        <button ref={interiorLauncher} type="button" className="control-button cabin-enter" data-action="interior" disabled={!available || !state.cabin.available} onClick={() => send({ type: 'interior' })}>ENTER INTERIOR <Icon/></button>
        <ActionButton action="lights" send={send} className="icon-button" disabled={!available} aria-label="Headlights" title="Toggle headlights" aria-pressed={state.lights}><Icon name="light"/></ActionButton>
      </div>
      <DetailExplorer state={state} send={send}/>
    </div>
    <div className="workspace-panel" role="tabpanel" id="panel-customize" aria-labelledby="tab-customize" hidden={state.mode !== 'customize'} tabIndex={0}>
      <ConfiguratorPanel state={state} send={send}/>
    </div>
    <div className="workspace-panel" role="tabpanel" id="panel-photo" aria-labelledby="tab-photo" hidden={state.mode !== 'photo'} tabIndex={0}>
      <div className="workspace-caption"><span>FIND YOUR ANGLE.</span><small>Drag to compose. Clean view removes the interface.</small></div>
      <div className="workspace-actions"><ActionButton action="clean-photo" send={send} disabled={!available} aria-pressed={state.cleanView}><Icon name="camera"/>CLEAN VIEW</ActionButton>
        <ActionButton action="reset-camera" send={send} disabled={!available}><Icon name="replay"/>RESET CAMERA</ActionButton></div>
      <p className="workspace-note">Framing workspace · image export and lighting presets are not part of this release.</p>
    </div>
  </section>;
}
