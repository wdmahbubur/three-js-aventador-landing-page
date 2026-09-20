'use client';

import { useEffect, useRef } from 'react';
import { pageMarkup } from '../lib/markup.mjs';

export default function Experience() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let mounted = true;
    let destroy: (() => void) | undefined;
    import('../lib/controller.mjs').then(({ mountExperience }) => {
      if (mounted && root.current) destroy = mountExperience(root.current);
    }).catch((error: unknown) => {
      console.error('The experience controller could not start.', error);
      if (root.current) {
        root.current.dataset.engine = 'error';
        const text = root.current.querySelector('[data-status]');
        if (text) text.textContent = 'Interactive experience unavailable. Scroll to explore the design.';
      }
    });
    return () => { mounted = false; destroy?.(); };
  }, []);
  return <div ref={root} className="experience" data-engine="loading" data-phase="0" dangerouslySetInnerHTML={{ __html: pageMarkup() }} />;
}
