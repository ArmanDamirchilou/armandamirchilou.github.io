import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';

// The twin page pulls in the avatar + chat + audio stack — load it on demand
// so the homepage stays light.
const Twin = lazy(() => import('./pages/Twin').then((m) => ({ default: m.Twin })));
const Contact = lazy(() => import('./pages/Contact').then((m) => ({ default: m.Contact })));

function PageLoader() {
  return (
    <div className="page-loader">
      <div className="page-loader-orb" />
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/twin"
        element={
          <Suspense fallback={<PageLoader />}>
            <Twin />
          </Suspense>
        }
      />
      <Route
        path="/contact"
        element={
          <Suspense fallback={<PageLoader />}>
            <Contact />
          </Suspense>
        }
      />
    </Routes>
  );
}
