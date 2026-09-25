import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Action, ShowroomState } from '../../lib/showroom/state';
export interface UIProps { state: Readonly<ShowroomState>; send(action: Action): void }
const paths = {
  arrow: 'M5 12h14M12 5l7 7-7 7', down: 'M12 4v15m-6-6 6 6 6-6',
  replay: 'M4 10a8 8 0 1 1 .8 7M4 4v6h6', close: 'm6 6 12 12M6 18 18 6',
  light: 'M14 6c-6 0-8 3-8 6s2 6 8 6V6Zm4 1h4m-4 5h4m-4 5h4',
  layers: 'm12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5',
  door: 'm5 20 3-15h9l3 15M8 5l-4 9m3-2h10m-8 4h2',
  camera: 'M3 7h4l2-3h6l2 3h4v13H3V7Zm9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8'
};
export function Icon({ name = 'arrow' }: { name?: keyof typeof paths | 'orbit' }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">{name === 'orbit' ? <><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-30 12 12)"/><circle cx="12" cy="12" r="3"/></> : <path d={paths[name]}/>}</svg>;
}
export function ActionButton({ action, send, children, className = 'control-button', ...props }:
  { action: Exclude<Action, { progress: number } | { mode: string } | { finish: string } | { quality: string } | { key: string } | { section: string } | { id: string }>['type']; send(action: Action): void; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  // Parameterized commands use their own typed controls; these buttons send simple commands.
  return <button type="button" data-action={action} className={className} onClick={() => send({ type: action })} {...props}>{children}</button>;
}
export function Brand() {
  return <><svg className="brand-mark" viewBox="0 0 44 50" fill="none" aria-hidden="true"><path d="M3 3h38v25L22 47 3 28V3Z"/><path d="M13 14h10c6 0 8 8 2 11l7 10h-7l-7-10h-1v10h-5V14Z"/></svg><span>LAMBORGHINI<small>REVUELTO · ASSEMBLY EXPERIENCE</small></span></>;
}
