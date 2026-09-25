import { DEFAULT_CONFIGURATION, validConfigOption } from '../configuration.mjs';

/** Low-frequency UI state. Camera vectors, mesh transforms and scrub values stay in the engine. */
export const MODES = ['explore', 'customize', 'photo'] as const;
export type Mode = typeof MODES[number];
export type Finish = 'rosso' | 'arancio' | 'graphite' | 'bianco' | 'verde' | 'blu';
export interface Configuration { paint: Finish; paintFinish: 'gloss' | 'matte'; carbon: 'satin' | 'polished'; wheels: 'graphite' | 'silver' | 'bronze'; calipers: 'rosso' | 'giallo' | 'nero'; seats: 'original' | 'ivory' | 'tan' | 'nero'; accents: 'original' | 'rosso' | 'arancio' | 'ivory' }
export type ConfigKey = keyof Configuration;
export type ConfigSection = 'exterior' | 'wheels' | 'interior' | 'review';
export type DetailId = 'headlights' | 'wheels' | 'doors' | 'cockpit' | 'engine';
export type Quality = 'auto' | 'high' | 'eco';
export type CabinMode = 'exterior' | 'entering' | 'inside' | 'exiting';
export interface CabinState { mode: CabinMode; available: boolean; doorsOpen: boolean; error: string | null }
export interface ShowroomState {
  engine: 'loading' | 'ready' | 'error' | 'deferred'; status: string; announcement: string;
  percent: number; chapter: number; finished: boolean; introHidden: boolean;
  reduced: boolean; quality: Quality; finish: Finish; mode: Mode;
  inspecting: boolean; exploded: boolean; cleanView: boolean; creditsOpen: boolean;
  configuration: Readonly<Configuration>; configSection: ConfigSection; configCapabilities: Partial<Record<ConfigKey, boolean>>;
  activeDetail: DetailId | null; hotspotsEnabled: boolean;
  cabin: Readonly<CabinState>; lights: boolean; fontsReady: boolean;
}
export const INITIAL_STATE: Readonly<ShowroomState> = Object.freeze({
  engine: 'loading', status: 'Preparing the interactive showroom…', announcement: '',
  percent: 0, chapter: 0, finished: false, introHidden: false,
  reduced: false, quality: 'auto', finish: 'rosso', mode: 'explore',
  inspecting: false, exploded: false, cleanView: false, creditsOpen: false,
  cabin: Object.freeze({ mode: 'exterior', available: false, doorsOpen: false, error: null }),
  lights: true, fontsReady: false, configuration: DEFAULT_CONFIGURATION as Readonly<Configuration>, configSection: 'exterior',
  configCapabilities: Object.freeze({}), activeDetail: null, hotspotsEnabled: true
});
export function isMode(value: unknown): value is Mode { return MODES.some(mode => mode === value); }
export function isFinish(value: unknown): value is Finish { return validConfigOption('paint', value); }
export function isQuality(value: unknown): value is Quality { return ['auto', 'high', 'eco'].includes(String(value)); }
export function modeAtKey(mode: Mode, key: string): Mode {
  const index = MODES.indexOf(mode);
  if (key === 'Home') return MODES[0];
  if (key === 'End') return MODES[2];
  if (key === 'ArrowRight') return MODES[(index + 1) % MODES.length];
  if (key === 'ArrowLeft') return MODES[(index + MODES.length - 1) % MODES.length];
  return mode;
}
export function createShowroomStore() {
  let snapshot = INITIAL_STATE;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => INITIAL_STATE,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    patch(patch: Partial<ShowroomState>) {
      if (!Object.keys(patch).some(key => !Object.is(snapshot[key as keyof ShowroomState], patch[key as keyof ShowroomState]))) return;
      snapshot = Object.freeze({ ...snapshot, ...patch });
      listeners.forEach(listener => listener());
    }
  };
}
export type ShowroomStore = ReturnType<typeof createShowroomStore>;
export type Action =
  | { type: 'jump'; progress: number; immediate?: boolean }
  | { type: 'mode'; mode: Mode }
  | { type: 'finish'; finish: Finish }
  | { type: 'quality'; quality: Quality }
  | { type: 'configure'; key: ConfigKey; value: string }
  | { type: 'config-section'; section: ConfigSection }
  | { type: 'detail'; id: DetailId }
  | { type: 'reveal' | 'replay' | 'motion' | 'inspect' | 'explode' | 'lights' | 'doors' | 'interior' | 'exit-interior' |
      'cabin-front' | 'cabin-left' | 'cabin-passenger' | 'cabin-doors' | 'credits' | 'close-credits' | 'retry' |
      'clean-photo' | 'reset-camera' | 'reset-finish' | 'reset-build' | 'clear-detail' | 'toggle-hotspots' };
