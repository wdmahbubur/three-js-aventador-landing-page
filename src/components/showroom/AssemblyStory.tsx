import { CHAPTERS } from '../../lib/config.mjs';
import { ActionButton, Icon, type UIProps } from './ui';
// Plain text, not HTML strings. Semantic emphasis is composed as JSX.
const TITLES = [['EXTRAORDINARY.', 'FROM NOTHING.'], ['EVERY ICON', 'STARTS WITHIN.'], ['PURE', 'INSTINCT.'],
  ['PRECISION.', 'IN MOTION.'], ['BUILT AROUND', 'THE DRIVER.'], ['NOT A LINE', 'OUT OF PLACE.'], ['THE FINAL', 'SIGNATURE.'], ['MORE THAN', 'THE SUM.']];
const COPY = [
  ['An icon is not born complete.', 'It comes together, one extraordinary detail at a time.'],
  ['The first elements take their place.', 'A foundation for everything that follows.'],
  ['At its heart, the engine.', 'A mechanical centrepiece, revealed before the body closes around it.'],
  ['Four corners. One purpose.', 'Wheels and brakes align, then settle into place.'],
  ['Seats, instruments, and controls.', 'The inside story takes shape.'],
  ['Sculpted surfaces find their position.', 'What was a collection of parts becomes unmistakable.'],
  ['Glass. Mirrors. Light.', 'The details that make the whole impossible to ignore.'],
  ['Lamborghini Revuelto.', 'Extraordinary, from every angle.']
];
export function AssemblyStory({ state, send }: UIProps) {
  const chapter = CHAPTERS[state.chapter], active = state.cabin.mode !== 'exterior' || state.cleanView;
  return <>
    <div className="hero-copy" data-intro aria-hidden={state.introHidden} inert={state.introHidden || active}>
      <p className="eyebrow"><span className="live-dot"/>AN EXPLORATION IN PRECISION</p>
      <h1>EXTRAORDINARY.<br/><span className="outline">FROM NOTHING.</span></h1>
      <p className="intro-description">An icon is not born complete.<br/>It comes together, one extraordinary detail at a time.</p>
      <div className="entry-choices"><button className="begin-button" type="button" data-jump=".12" onClick={() => send({ type: 'jump', progress: .12 })}><span className="hex-button"><Icon name="down"/></span><span>WATCH ASSEMBLY<small>SCROLL AT YOUR OWN PACE.</small></span></button>
        <ActionButton action="reveal" send={send} className="text-button">EXPLORE NOW <Icon/></ActionButton></div>
    </div>
    <div className="chapter-copy" data-story aria-hidden={state.chapter === 0} style={{ opacity: state.chapter ? 1 : 0 }}>
      <p className="eyebrow" data-kicker>{chapter.kicker}</p><h2 data-title>{TITLES[state.chapter][0]}<br/><em>{TITLES[state.chapter][1]}</em></h2>
      <p className="chapter-description" data-description>{COPY[state.chapter][0]}<br/>{COPY[state.chapter][1]}</p>
    </div>
    <nav className="chapter-rail" aria-label="Assembly chapters" inert={active}>{CHAPTERS.map((item, i) => <button key={item.id} type="button" className={`chapter-dot${state.chapter === i ? ' is-active' : ''}`} aria-current={state.chapter === i ? 'step' : undefined}
      data-chapter={i} aria-label={item.kicker} onClick={() => send({ type: 'jump', progress: i === 7 ? 1 : i ? item.at + .015 : 0 })}><span className="rail-label">{item.label}</span><span className="dot"/></button>)}</nav>
    <div className="stage-bottom" inert={active}><div className="assembly-meter"><div className="meter-heading mono"><span data-chapter-label>{chapter.label.toUpperCase()}</span><span><strong data-percent>{String(state.percent).padStart(2, '0')}</strong><span className="percent-symbol">%</span></span></div>
      <div className="meter-track" role="progressbar" aria-label="Assembly progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.percent} data-meter><span data-meter-fill/></div>
      <p className="status-line" data-status role="status">{state.status}</p></div>
      <div className="stage-actions"><ActionButton action="reveal" send={send} className="text-button" hidden={state.finished}>SKIP TO REVEAL <Icon/></ActionButton>
        <ActionButton action="replay" send={send} className="text-button" hidden={!state.finished}><Icon name="replay"/>REPLAY ASSEMBLY</ActionButton>
        <ActionButton action="motion" send={send} className="motion-button" aria-pressed={state.reduced}>MOTION <span data-motion-label>{state.reduced ? 'REDUCED' : 'FULL'}</span></ActionButton></div>
    </div>
  </>;
}
