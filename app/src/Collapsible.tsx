import { useEffect, useState, type ReactNode } from 'react';

export default function Collapsible({ open, id, children }: { open: boolean; id: string; children: ReactNode }) {
  const [present, setPresent] = useState(open);

  useEffect(() => {
    if (open) { setPresent(true); return; }
    if (!present) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setPresent(false); return; }
    const timer = setTimeout(() => setPresent(false), 320);
    return () => clearTimeout(timer);
  }, [open, present]);

  return <div id={id} className="reveal-panel" data-reveal="" data-open={open} aria-hidden={!open} inert={!open}
    onTransitionEnd={event => {
      if (event.target === event.currentTarget && event.propertyName === 'grid-template-rows' && !open) setPresent(false);
    }}>
    <div className="reveal-inner">{(open || present) && children}</div>
  </div>;
}
