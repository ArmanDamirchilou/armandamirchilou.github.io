import { Link } from 'react-router-dom';

/** Paperfolio card nav: logo circle, bold centered links, black mail button. */
export function Navbar() {
  return (
    <div className="pf-navwrap">
      <nav className="pf-nav" aria-label="Main">
        <Link to="/" className="pf-nav-logo" aria-label="Home">A</Link>
        <div className="pf-nav-links">
          <a href="/#top">Home</a>
          <a href="/#about">About</a>
          <a href="/#portfolio">Portfolio</a>
          <Link to="/twin">AI Twin</Link>
          <Link to="/contact">Contact Me</Link>
        </div>
        <Link to="/contact" className="pf-nav-mail" aria-label="Contact Arman">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
            <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
            <path d="m3 7 9 6 9-6" />
          </svg>
        </Link>
      </nav>
    </div>
  );
}
