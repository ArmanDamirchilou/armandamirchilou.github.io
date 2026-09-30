import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { HomeV2 } from './pages/HomeV2';

// The twin page pulls in the avatar + chat + audio stack — load it on demand
// so the homepage stays light.
const Twin = lazy(() => import('./pages/Twin').then((m) => ({ default: m.Twin })));
const Contact = lazy(() => import('./pages/Contact').then((m) => ({ default: m.Contact })));
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })));

function PageLoader() {
  return (
    <div className="page-loader">
      <div className="page-loader-orb" />
    </div>
  );
}

const lazyRoute = (el: React.ReactNode) => <Suspense fallback={<PageLoader />}>{el}</Suspense>;

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeV2 />} />
      <Route path="/twin" element={lazyRoute(<Twin />)} />
      <Route path="/contact" element={lazyRoute(<Contact />)} />
      <Route path="*" element={lazyRoute(<NotFound />)} />
    </Routes>
  );
}
