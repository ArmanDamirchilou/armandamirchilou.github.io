import { Link } from 'react-router-dom';

/** Paperfolio black footer — shared by the homepage and the contact page. */
export function PageFooter() {
  return (
    <footer className="pf-footer" id="contact">
      <div className="container">
        <div className="footer-cta">
          <h3>Don't read about me — talk to me.</h3>
          <Link to="/twin" className="btn-solid">Open the AI twin</Link>
        </div>

        <div className="footer-grid">
          <div className="footer-brand">
            <div className="footer-brand-name">
              <span className="logo-dot" aria-hidden>A</span>
              Arman Damirchilou
            </div>
            <p>AI researcher & engineer from Tehran, Iran. Building intelligent systems — and a lab of my own, someday soon.</p>
            <div className="footer-socials">
              <a href="https://github.com/ArmanDamirchilou" target="_blank" rel="noopener" className="blue" aria-label="GitHub">GH</a>
              <a href="https://www.linkedin.com/in/arman-damirchilou-a98322369/" target="_blank" rel="noopener" className="blue" aria-label="LinkedIn">in</a>
              <a href="https://x.com/ArmanDamir5923" target="_blank" rel="noopener" className="coral" aria-label="X / Twitter">X</a>
              <a href="https://t.me/armandamirchilou" target="_blank" rel="noopener" className="coral" aria-label="Telegram">TG</a>
            </div>
          </div>

          <div className="footer-col">
            <h3>Pages</h3>
            <ul>
              <li><a href="/#top">Home</a></li>
              <li><a href="/#about">About</a></li>
              <li><a href="/#portfolio">Portfolio</a></li>
              <li><a href="/#journey">Journey</a></li>
              <li><Link to="/twin">AI Twin</Link></li>
              <li><Link to="/contact">Contact Me</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h3>Contact</h3>
            <ul>
              <li><a href="mailto:armandamirchilou@gmail.com">armandamirchilou@gmail.com</a></li>
              <li><a href="https://t.me/armandamirchilou" target="_blank" rel="noopener">Telegram — fastest reply</a></li>
              <li><Link to="/contact">All ways to reach me →</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          © {new Date().getFullYear()} Arman Damirchilou — designed & built by me (with my twin watching).
        </div>
      </div>
    </footer>
  );
}
