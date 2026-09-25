import type { Action, CabinState, Configuration, ConfigKey, DetailId, Finish, Quality, ShowroomStore } from './state';

/** Explicit boundary around the independently tested legacy WebGL engine. */
export interface EnginePort {
  setProgress(value: number): void; setFinish(value: Finish): void; setQuality(value: Quality): void;
  setActive(value: boolean): void; setReduced(value: boolean): void; setLights(value: boolean): void;
  setInspect(value: boolean): boolean; setExploded(value: boolean): void;
  setDoors(value: boolean): boolean; setInterior(value: boolean): boolean;
  setCabinView(value: 'dashboard' | 'left' | 'passenger'): void; resetCabin(closeDoors?: boolean): void;
  getConfigurationCapabilities(): Partial<Record<ConfigKey, boolean>>;
  setConfiguration(config: Readonly<Configuration>): void; focusDetail(id: DetailId): boolean; clearDetail(restore?: boolean): void;
  bindHotspots(elements: HTMLButtonElement[]): void; setHotspotsEnabled(value: boolean): void;
  emitCabinState(): void; getState(): Record<string, unknown>; dispose(): void;
}
export interface EngineOptions {
  reduced: boolean; onStatus(text: string): void; onReady(): void; onError(error: unknown): void;
  onCabinState(state: CabinState): void; onExitInspect(): void; onDetailState(id: DetailId | null): void;
}
export type EngineConstructor = new (host: HTMLElement, options: EngineOptions) => EnginePort;
export interface RuntimeElements {
  root: HTMLDivElement; track: HTMLElement; host: HTMLDivElement; cabinOverlay: HTMLElement;
  interiorLauncher: HTMLButtonElement;
}
export interface Runtime { send(action: Action): void; dispose(): void }
export interface RuntimeOptions extends RuntimeElements { store: ShowroomStore }
