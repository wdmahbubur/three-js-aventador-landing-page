'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createShowroomStore, type Action } from '../lib/showroom/state';
import type { Runtime } from '../lib/showroom/contracts';

export function useShowroom() {
  const [store] = useState(createShowroomStore);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const root = useRef<HTMLDivElement>(null), track = useRef<HTMLElement>(null), host = useRef<HTMLDivElement>(null);
  const cabinOverlay = useRef<HTMLElement>(null), interiorLauncher = useRef<HTMLButtonElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const send = useCallback((action: Action) => { runtime.current?.send(action); }, []);
  useEffect(() => {
    let disposed = false;
    import('../lib/showroom/runtime').then(({ mountShowroom }) => {
      if (disposed || !root.current || !track.current || !host.current || !cabinOverlay.current || !interiorLauncher.current) return;
      runtime.current = mountShowroom({ root: root.current, track: track.current, host: host.current,
        cabinOverlay: cabinOverlay.current, interiorLauncher: interiorLauncher.current, store });
    }).catch((error: unknown) => {
      if (disposed) return;
      console.error('Showroom startup failed', error);
      store.patch({ engine: 'error', status: 'Interactive showroom unavailable. The design story remains available.' });
    });
    return () => { disposed = true; runtime.current?.dispose(); runtime.current = null; };
  }, [store]);
  return { state, send, root, track, host, cabinOverlay, interiorLauncher };
}
