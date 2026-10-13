import { useLayoutEffect, useRef } from 'react';

export function useAnchoredLayout() {
  const shell = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const main = shell.current;
    if (!main) return;
    const footer = main.parentElement?.querySelector<HTMLElement>('.version-footer');
    const place = () => {
      // Center the closed page. Expanded sections only consume space below it.
      const expanded = [...main.querySelectorAll<HTMLElement>('[data-reveal]')]
        .reduce((height, panel) => height + panel.getBoundingClientRect().height, 0);
      const closedHeight = main.getBoundingClientRect().height - expanded;
      const top = Math.max(0, (window.innerHeight - closedHeight - (footer?.getBoundingClientRect().height ?? 0)) / 2);
      main.style.setProperty('--shell-top', `${top}px`);
    };
    const observer = new ResizeObserver(place);
    observer.observe(main);
    if (footer) observer.observe(footer);
    window.addEventListener('resize', place);
    place();
    return () => { observer.disconnect(); window.removeEventListener('resize', place); };
  }, []);

  return shell;
}
