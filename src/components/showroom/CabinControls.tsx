import { CabinPalette } from './ConfiguratorPanel';
import type { RefObject } from 'react';
import { ActionButton, Icon, type UIProps } from './ui';
export function CabinControls({ state, send, overlayRef }: UIProps & { overlayRef: RefObject<HTMLElement | null> }) {
  const { mode, doorsOpen, available } = state.cabin;
  const seated = mode === 'inside', busy = mode === 'entering' || mode === 'exiting';
  return <section ref={overlayRef} className="cabin-overlay" data-cabin-overlay aria-label="First-person cabin experience" hidden={mode === 'exterior'}>
    <div className="cabin-top"><div><p className="eyebrow">A DIFFERENT PERSPECTIVE</p>
      <h2 data-cabin-title>{seated ? 'THE DRIVER’S SEAT.' : mode === 'exiting' ? 'BACK TO THE SHOWROOM.' : 'TAKE YOUR SEAT.'}</h2>
      <p data-cabin-status>{seated ? 'Look around. Explore every detail.' : mode === 'exiting' ? 'Returning to the exterior view…' : 'Opening the doors and entering the cabin…'}</p></div>
      <ActionButton action="exit-interior" send={send} className="control-button cabin-exit">EXIT INTERIOR <Icon name="close"/></ActionButton>
    </div>
    <div className="cabin-bottom">{seated && <CabinPalette state={state} send={send}/>}<p className="cabin-help">DRAG TO LOOK AROUND <span>·</span> ARROW KEYS / WASD <span>·</span> ESC TO EXIT</p>
      <div className="cabin-presets" role="group" aria-label="Cabin viewpoints">
        <ActionButton action="cabin-left" send={send} disabled={!seated}>LEFT DOOR</ActionButton>
        <ActionButton action="cabin-front" send={send} disabled={!seated}>DASHBOARD</ActionButton>
        <ActionButton action="cabin-passenger" send={send} disabled={!seated}>PASSENGER</ActionButton>
        <ActionButton action="cabin-doors" send={send} disabled={!available || busy} aria-pressed={doorsOpen}><span data-cabin-door-label>{doorsOpen ? 'CLOSE DOORS' : 'OPEN DOORS'}</span></ActionButton>
      </div><p className="cabin-note">FIRST-PERSON VIEW · ORIGINAL MODEL INTERIOR</p>
    </div>
  </section>;
}
