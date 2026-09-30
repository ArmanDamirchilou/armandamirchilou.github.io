import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTehranTime } from '../hooks/useTehranTime';
import { LINKS } from './content';
import { scrollToTarget } from './scroll';
import { Aurora } from './Aurora';
import { useGlassPointer } from './useGlassPointer';
import '../styles/glass.css';
import '../styles/v2-glass.css';
import '../styles/v2-mobile.css';

const SECTIONS = [
  { hash: '#work', label: 'Work' },
  { hash: '#journey', label: 'Journey' },
  { hash: '#profile', label: 'Profile' },
];

/** Puts the v2 ground on <html>/<body> while a v2 page is mounted. */
export function useV2Root() {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('is-v2');
    return () => html.classList.remove('is-v2');
  }, []);
}

/** The living wallpaper every v2 page's glass floats over. */
export function V2Backdrop() {
  useGlassPointer();
  return <Aurora />;
}

const Icon = {
  home: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1v-7.5Z" />,
  work: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
      <rect x="13" y="13" width="7" height="7" rx="2" />
    </>
  ),
  journey: <path d="M6 20V5m0 0h10l-2 3.5L16 12H6" />,
  profile: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </>
  ),
  wave: <path d="M4 12h1.5M8 8.5v7M12 5v14M16 8v8M20 11v2" />,
};

const TABS = [
  { hash: '#top', label: 'Home', icon: Icon.home },
  { hash: '#work', label: 'Work', icon: Icon.work },
  { hash: '#journey', label: 'Journey', icon: Icon.journey },
  { hash: '#profile', label: 'Profile', icon: Icon.profile },
];

/** Which home section is on screen, for the phone tab bar's highlight. */
function useActiveSection(enabled: boolean) {
  const [active, setActive] = useState('#top');
  useEffect(() => {
    if (!enabled) return;
    const ids = ['#work', '#journey', '#profile'];
    const pick = () => {
      // The last section whose top has passed a third of the way down.
      const line = window.innerHeight / 3;
      let current = '#top';
      for (const id of ids) {
        const el = document.querySelector(id);
        if (el && el.getBoundingClientRect().top < line) current = id;
      }
      setActive(current);
    };
    pick();
    window.addEventListener('scroll', pick, { passive: true });
    return () => window.removeEventListener('scroll', pick);
  }, [enabled]);
  return active;
}

export function V2Nav() {
  const { pathname } = useLocation();
  const onHome = pathname === '/';
  const time = useTehranTime();
  const active = useActiveSection(onHome);

  const go = (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    if (!onHome) return; // let the router take us to /#section
    e.preventDefault();
    scrollToTarget(hash === '#top' ? 0 : hash);
    history.replaceState(null, '', hash === '#top' ? '/' : hash);
  };

  return (
    <>
      <header className="v2-nav lg lg-pill">
        <Link to="/" className="v2-nav-name" onClick={(e) => go(e, '#top')}>
          <span className="v2-nav-mono" aria-hidden>AD</span>
          Arman Damirchilou
        </Link>
        <nav aria-label="Sections">
          {SECTIONS.map((s) => (
            <Link key={s.hash} to={`/${s.hash}`} onClick={(e) => go(e, s.hash)}>
              {s.label}
            </Link>
          ))}
          <Link to="/twin" className="v2-nav-twin lg-press">
            Talk to my twin
          </Link>
        </nav>
        <span className="v2-nav-time" aria-label={`Tehran time ${time}`}>
          <i aria-hidden /> Tehran {time}
        </span>
      </header>

      {/* Phones: the sections live in a floating tab bar under the thumb, and
          the twin gets its own button beside it, like a system app. */}
      <nav className="v2-tabbar" aria-label="Sections">
        <div
          className={`v2-tabbar-tabs lg lg-pill${onHome ? '' : ' no-lens'}`}
          style={{ '--tab': TABS.findIndex((t) => t.hash === active) } as React.CSSProperties}
        >
          <span className="v2-tabbar-lens" aria-hidden />
          {TABS.map((t) => (
            <Link
              key={t.hash}
              to={t.hash === '#top' ? '/' : `/${t.hash}`}
              onClick={(e) => go(e, t.hash)}
              className={onHome && active === t.hash ? 'is-active' : undefined}
              aria-current={onHome && active === t.hash ? 'true' : undefined}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {t.icon}
              </svg>
              <span>{t.label}</span>
            </Link>
          ))}
        </div>
        <Link to="/twin" className="v2-tabbar-twin lg lg-accent lg-press" aria-label="Talk to my twin">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            {Icon.wave}
          </svg>
        </Link>
      </nav>
    </>
  );
}

export function V2Footer() {
  const time = useTehranTime();
  return (
    <footer className="v2-footer v2-wrap" id="contact">
      <h2 className="v2-footer-title">Let's build something.</h2>
      <a className="v2-footer-mail" href={`mailto:${LINKS.email}`}>
        {LINKS.email}
      </a>
      <div className="v2-footer-row">
        <nav aria-label="Elsewhere" className="v2-footer-links">
          <a href={LINKS.github} target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href={LINKS.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>
          <a href={LINKS.x} target="_blank" rel="noopener noreferrer">X</a>
          <a href={LINKS.telegram} target="_blank" rel="noopener noreferrer">Telegram</a>
          <Link to="/contact">Contact</Link>
        </nav>
        <span className="v2-meta">Tehran {time}</span>
      </div>
      <div className="v2-footer-row v2-footer-fine">
        <span>Designed and built by Arman Damirchilou.</span>
        <Link to="/classic">See the classic site</Link>
      </div>
    </footer>
  );
}
