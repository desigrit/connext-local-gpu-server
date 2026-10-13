import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export default function DelayedTooltip({ children, text }: { children: ReactNode; text: string }) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const hide = () => { clear(); setVisible(false); };
  const schedule = () => { clear(); timer.current = setTimeout(() => setVisible(true), 2000); };
  useEffect(() => clear, []);
  return <span className="row-name" onPointerEnter={schedule} onPointerLeave={hide} onFocus={schedule} onBlur={hide} onKeyDown={event => { if (event.key === 'Escape') hide(); }}>
    <span className="tooltip-anchor" aria-describedby={visible ? id : undefined}>{children}</span>
    {visible && <span id={id} className="row-tooltip" role="tooltip">{text}</span>}
  </span>;
}
