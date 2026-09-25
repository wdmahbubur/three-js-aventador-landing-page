import { CONFIG_OPTIONS, CONFIG_KEYS, configurationLabel } from '../../lib/configuration.mjs';
import type { ConfigKey, ConfigSection } from '../../lib/showroom/state';
import { ActionButton, Icon, type UIProps } from './ui';

const labels: Record<ConfigKey, string> = { paint: 'Body colour', paintFinish: 'Paint finish', carbon: 'Exterior carbon', wheels: 'Wheel finish', calipers: 'Brake calipers', seats: 'Seat inserts', accents: 'Cabin accents' };
const sections: ConfigSection[] = ['exterior', 'wheels', 'interior', 'review'];
function Options({ field, state, send }: UIProps & { field: ConfigKey }) {
  const available = state.engine === 'ready' && state.configCapabilities[field];
  const options = CONFIG_OPTIONS[field] as ReadonlyArray<{ id: string; name: string; color?: string }>;
  return <fieldset className="config-field" disabled={!available} data-config-field={field}>
    <legend>{labels[field]} <span>{configurationLabel(field, state.configuration[field])}</span></legend>
    <div className={`config-options ${field === 'paint' ? 'config-paints' : ''}`}>
      {options.map(option => <button key={option.id} type="button" className="config-option" data-config={field} data-value={option.id}
        data-finish={field === 'paint' ? option.id : undefined} aria-pressed={state.configuration[field] === option.id}
        onClick={() => send({ type: 'configure', key: field, value: option.id })}>
        {option.color && <span className="paint-chip" style={{ background: option.color }}/>}<span>{option.name.replace(' / Carbon', '')}</span>
      </button>)}
    </div>
    {!available && state.engine === 'ready' && <small>This model does not expose this material separately.</small>}
  </fieldset>;
}
export function ConfiguratorPanel({ state, send }: UIProps) {
  const section = state.configSection;
  return <>
    <div className="config-sections" role="group" aria-label="Configuration steps">
      {sections.map((id, i) => <button type="button" key={id} data-config-section={id} aria-pressed={section === id}
        onClick={() => send({ type: 'config-section', section: id })}><small>0{i + 1}</small>{id}</button>)}
    </div>
    <div className="config-content">
      <div className="config-step" hidden={section !== 'exterior'}><Options field="paint" state={state} send={send}/><Options field="paintFinish" state={state} send={send}/><Options field="carbon" state={state} send={send}/></div>
      <div className="config-step" hidden={section !== 'wheels'}><Options field="wheels" state={state} send={send}/><Options field="calipers" state={state} send={send}/><p className="config-note">Original wheel geometry. Your choices change its finish, not its design.</p></div>
      <div className="config-step" hidden={section !== 'interior'}><Options field="seats" state={state} send={send}/><Options field="accents" state={state} send={send}/>
        <button type="button" className="control-button" data-action="preview-interior" disabled={state.engine !== 'ready' || !state.cabin.available} onClick={() => send({ type: 'interior' })}>PREVIEW FROM THE DRIVER’S SEAT <Icon/></button>
        <p className="config-note">Changes apply only to the model’s seat inserts and coloured cabin trim. Logos, screens and glass stay unchanged.</p>
      </div>
      <div className="config-step" hidden={section !== 'review'}><h3 className="config-review-title">YOUR ATELIER BUILD.</h3><dl className="build-summary">
        {(CONFIG_KEYS as ConfigKey[]).map(key => <div key={key}><dt>{labels[key]}</dt><dd data-build-value={key}>{configurationLabel(key, state.configuration[key])}</dd></div>)}
      </dl><p className="config-note">These are independent presentation options, not manufacturer order codes or prices. Your selection stays during this visit; saving and sharing are a later feature.</p></div>
    </div>
    <div className="config-footer"><span data-finish-name>{configurationLabel('paint', state.finish)}</span><div>
      <ActionButton action="reset-finish" send={send} className="text-button" disabled={state.engine !== 'ready'}>RESET FINISH</ActionButton>
      <ActionButton action="reset-build" send={send} className="text-button" disabled={state.engine !== 'ready'}>RESET BUILD <Icon name="replay"/></ActionButton>
    </div></div>
  </>;
}

export function CabinPalette({ state, send }: UIProps) {
  return <details className="cabin-palette" style={{ pointerEvents: 'auto' }}><summary onKeyDown={event => { if (event.key === ' ') event.stopPropagation(); }}>CABIN FINISHES</summary><div>
    {(['seats', 'accents'] as const).map(key => <label key={key}>{labels[key]}<select data-cabin-config={key} value={state.configuration[key]}
      onKeyDown={event => { if ([' ', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) event.stopPropagation(); }}
      disabled={state.cabin.mode !== 'inside' || !state.configCapabilities[key]} onChange={event => send({ type: 'configure', key, value: event.target.value })}>
      {CONFIG_OPTIONS[key].map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
    </select></label>)}
  </div></details>;
}
