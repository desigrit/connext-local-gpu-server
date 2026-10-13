import { useEffect } from 'react';

export function useClickFeedback() {
  useEffect(() => {
    const root = document.getElementById('root');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const running = new Map<Element, Animation>();
    let disposed = false;
    const flutter = (event: MouseEvent) => {
      if (motion.matches || !(event.target instanceof Element)) return;
      const control = event.target.closest('button, a, summary');
      if (!control || control.matches(':disabled, .hour-column')) return;
      requestAnimationFrame(() => {
        if (disposed || !control.isConnected || motion.matches) return;
        const icon = control.querySelector('svg:not(.spin):not(.row-chevron), .brand-icon');
        if (control.querySelector('.spin')) return;
        const target = icon ?? control;
        running.get(target)?.cancel();
        const animation = target.animate(icon ? [
          { transform: 'rotate(0deg) scale(1)' },
          { transform: 'rotate(-7deg) scale(.94)', offset: .25 },
          { transform: 'rotate(4deg) scale(1)', offset: .6 },
          { transform: 'rotate(0deg) scale(1)' },
        ] : [{ transform: 'scale(1)' }, { transform: 'scale(.97)', offset: .3 }, { transform: 'scale(1)' }],
        { duration: icon ? 300 : 200, easing: 'cubic-bezier(.16, 1, .3, 1)' });
        running.set(target, animation);
        const clear = () => { if (running.get(target) === animation) running.delete(target); };
        void animation.finished.then(clear, clear);
      });
    };
    root?.addEventListener('click', flutter, true);
    return () => { disposed = true; root?.removeEventListener('click', flutter, true); running.forEach(animation => animation.cancel()); };
  }, []);
}
