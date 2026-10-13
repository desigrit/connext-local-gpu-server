import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyText, getPairingCode, type PairingCode } from './bridge';

export default function HostPairing({ active = true }: { active?: boolean }) {
  const [pairing, setPairing] = useState<PairingCode | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const generation = useRef(0);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 2500); return () => clearTimeout(timer); }, [copied]);
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let pending = false;
    let expires = 0;
    let retryAt = 0;
    async function refresh() {
      if (disposed || pending || document.hidden) return;
      pending = true; generation.current++; setBusy(true); setCopied(false);
      try {
        const value = await getPairingCode();
        if (disposed) return;
        if (!Number.isFinite(value.expiresAtMs) || value.expiresAtMs <= Date.now()) throw new Error('The pairing code has expired.');
        expires = value.expiresAtMs;
        setPairing(value); setNow(Date.now()); setError('');
      } catch (failure) {
        if (!disposed) { retryAt = Date.now() + 15000; setError(failure instanceof Error ? failure.message : String(failure)); }
      } finally { pending = false; if (!disposed) setBusy(false); }
    }
    const tick = () => {
      if (document.hidden) return;
      setNow(Date.now());
      if (Date.now() >= expires && Date.now() >= retryAt) void refresh();
    };
    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    void refresh();
    return () => { disposed = true; generation.current++; clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [active]);

  const seconds = Math.max(0, Math.ceil(((pairing?.expiresAtMs ?? now) - now) / 1000));
  const expired = seconds === 0;
  const countdown = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  async function copy() {
    if (!active || !pairing || busy || Date.now() >= pairing.expiresAtMs) return;
    const revision = generation.current;
    try { await copyText(pairing.code); if (revision === generation.current) { setCopied(true); setError(''); } }
    catch { if (revision === generation.current) setError('Could not copy. Select the code to copy it.'); }
  }

  return <div className="pairing-share">
    <div className="pairing-caption"><h3>Pair another device</h3></div>
    <p className="field-hint">Enter this code in Shambu on your other device.</p>
    <div className="pairing-code-line">
      <div className="pairing-code-copy">
        <output className={'pairing-code' + (expired ? ' is-expired' : '')} aria-label="Pairing code">{pairing ? pairing.code.slice(0, 4) + ' ' + pairing.code.slice(4) : busy ? 'Creating…' : 'Unavailable'}</output>
        <button type="button" className="icon-button pairing-copy" aria-label={copied ? 'Copied' : 'Copy code'} disabled={!pairing || expired || busy} onClick={() => void copy()}>{copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}</button>
      </div>
      <span className="pairing-countdown" aria-live="off">{pairing && !expired ? `Expires in ${countdown}` : busy ? 'Refreshing…' : error ? 'Retrying…' : ''}</span>
    </div>
    <span className="sr-only" role="status">{copied ? 'Pairing code copied' : ''}</span>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
