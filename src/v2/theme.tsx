import { useSyncExternalStore } from 'react';

/**
 * Light (white and cobalt) or dark (graphite and pomegranate). Every visit
 * opens in light: the choice holds while you move between pages, but it is
 * deliberately not remembered, and the system setting doesn't override it.
 * index.html already sets data-theme="light", so there's no flash on load.
 */
export type Theme = 'light' | 'dark';

const THEME_COLOR: Record<Theme, string> = { light: '#f7f9fc', dark: '#0c0d0f' };
const listeners = new Set<() => void>();

function current(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme: Theme) {
  const html = document.documentElement;
  html.dataset.theme = theme;
  html.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  listeners.forEach((l) => l());
}

export function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    current,
    () => 'light' as Theme
  );
  return [theme, () => setTheme(theme === 'light' ? 'dark' : 'light')];
}

/** The sun/moon switch, for the site header and the twin's top bar. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, toggle] = useTheme();
  const next = theme === 'light' ? 'dark' : 'light';
  return (
    <button type="button" className={`theme-toggle ${className}`} onClick={toggle} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      {theme === 'light' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
        </svg>
      )}
    </button>
  );
}
