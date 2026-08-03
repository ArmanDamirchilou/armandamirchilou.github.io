/**
 * Where the twin's backend lives.
 *
 * Empty (the default) keeps every request relative, so local dev keeps using
 * the Vite proxy on :3001. The Pages build sets VITE_API_URL to the deployed
 * Hugging Face Space, because a static host has no backend of its own.
 */
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

/** Absolute URL for a backend path, e.g. api('/api/chat') or api('/audio/x.mp3'). */
export function api(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/** True when the app is pointed at a remote backend rather than a local one. */
export const hasRemoteBackend = BASE.length > 0;
