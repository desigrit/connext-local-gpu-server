import { useEffect, useState } from 'react';

type WindowTheme = 'clean' | 'vines';
const storageKey = 'shambu.window-theme';

export function useWindowTheme(enabled: boolean): WindowTheme {
  const [theme, setTheme] = useState<WindowTheme>(() => {
    if (!enabled) return 'clean';
    try { return localStorage.getItem(storageKey) === 'vines' ? 'vines' : 'clean'; }
    catch { return 'clean'; }
  });

  useEffect(() => {
    if (!enabled) return;
    const toggle = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey || event.repeat || event.isComposing) return;
      if (event.code !== 'KeyK' && event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      setTheme(previous => previous === 'clean' ? 'vines' : 'clean');
    };
    window.addEventListener('keydown', toggle);
    return () => window.removeEventListener('keydown', toggle);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    try { localStorage.setItem(storageKey, theme); } catch { /* The shortcut still works for this session. */ }
  }, [enabled, theme]);

  return enabled ? theme : 'clean';
}
