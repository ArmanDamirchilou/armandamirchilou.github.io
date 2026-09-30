import { Link } from 'react-router-dom';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '../styles/v2.css';
import { Seo } from '../components/Seo';
import { V2Backdrop, V2Nav, useV2Root } from '../v2/Chrome';

export function NotFound() {
  useV2Root();
  return (
    <div className="v2">
      <Seo title="Page not found | Arman Damirchilou" description="This page doesn't exist." path="/404" />
      <V2Backdrop />
      <V2Nav />
      <main className="v2-notfound v2-wrap">
        <span className="v2-meta">404</span>
        <h1 className="v2-h2">Nothing here.</h1>
        <p>This page doesn't exist, but the rest of the site does.</p>
        <div className="v2-notfound-actions">
          <Link to="/" className="v2-btn v2-btn-accent">Go home</Link>
          <Link to="/twin" className="v2-link">Or ask my twin</Link>
        </div>
      </main>
    </div>
  );
}
