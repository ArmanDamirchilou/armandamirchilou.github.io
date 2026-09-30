import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTehranTime } from '../hooks/useTehranTime';
import { LINKS } from './content';
import { scrollToTarget } from './scroll';
import { Aurora } from './Aurora';
import { useGlassPointer } from './useGlassPointer';
import '../styles/glass.css';
import '../styles/v2-glass.css';

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

export function V2Nav() {
  const { pathname } = useLocation();
  const onHome = pathname === '/';

  const go = (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    if (!onHome) return; // let the router take us to /#section
    e.preventDefault();
    scrollToTarget(hash === '#top' ? 0 : hash);
    history.replaceState(null, '', hash === '#top' ? '/' : hash);
  };

  return (
    <header className="v2-nav lg lg-pill">
      <Link to="/" className="v2-nav-name" onClick={(e) => go(e, '#top')}>
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
    </header>
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
