import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { loadBackendConfig } from './lib/api';
import './styles/global.css';

function render() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
}

// Resolve the backend URL before the first paint so the twin never briefly
// points at the wrong host. It has its own timeout and never rejects, so a
// missing or slow backend.json cannot stop the site from rendering.
loadBackendConfig().finally(render);
