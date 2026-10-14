import { useId } from 'react';

export default function SettingsIcon({ open }: { open: boolean }) {
  const trackMask = useId();

  return <svg className="settings-icon" data-open={open} width="20" height="20" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <defs>
      <mask id={trackMask} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24" style={{ maskType: 'luminance' }}>
        <rect width="24" height="24" fill="white" stroke="none" />
        <circle className="settings-slider settings-slider-top" cx="7" cy="7" r="3" fill="black" stroke="none" />
        <circle className="settings-slider settings-slider-bottom" cx="17" cy="17" r="3" fill="black" stroke="none" />
      </mask>
    </defs>
    <g mask={`url(#${trackMask})`}>
      <path d="M5 7h14" />
      <path d="M5 17h14" />
    </g>
    <circle className="settings-slider settings-slider-top" cx="7" cy="7" r="3" />
    <circle className="settings-slider settings-slider-bottom" cx="17" cy="17" r="3" />
  </svg>;
}
