import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyText, getPairingCode, type PairingCode } from './bridge';

export default function HostPairing() {
  const [pairing, setPairing] = useState<PairingCode | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 2500); return () => clearTimeout(timer); }, [copied]);
  useEffect(() => {
    let active = true;
    setBusy(true);
    getPairingCode().then(value => { if (active) setPairing(value); }).catch(failure => { if (active) setError(String(failure)); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  async function renew() {
    setBusy(true); setError(''); setCopied(false);
    try { setPairing(await getPairingCode()); setNow(Date.now()); }
    catch (failure) { setError(String(failure)); }
    finally { setBusy(false); }
  }
  const expired = Boolean(pairing && now >= pairing.expiresAtMs);
  return <div className="pairing-share">
    <div className="pairing-caption"><h3>Pair another device</h3><span>{pairing ? expired ? 'Code expired' : 'One use · 5 minutes' : ''}</span></div>
    <p className="field-hint">On your other device, choose Remote server and enter this code.</p>
    <div className="pairing-code-line">
      <output className={'pairing-code' + (expired ? ' is-expired' : '')} aria-label="Pairing code">{pairing ? pairing.code.slice(0, 4) + ' ' + pairing.code.slice(4) : busy ? 'Creating…' : 'Unavailable'}</output>
      <button type="button" className="quiet-button" disabled={!pairing || expired || busy} onClick={async () => { try { await copyText(pairing!.code); setCopied(true); } catch { setError('Could not copy. Select the code to copy it.'); } }}><span aria-hidden="true">{copied ? <Check size={15} /> : <Copy size={15} />}</span>{copied ? 'Copied' : 'Copy code'}</button>
      <button type="button" className="text-action" disabled={busy} onClick={() => void renew()}>New code</button>
    </div>
    <span className="sr-only" role="status">{copied ? 'Pairing code copied' : ''}</span>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
