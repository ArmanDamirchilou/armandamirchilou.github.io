/**
 * Where the twin's backend lives.
 *
 * Resolved at runtime from /backend.json rather than baked in at build time,
 * because the backend is exposed through a dev tunnel whose URL changes every
 * restart. Editing one small JSON file and pushing it re-points the live site
 * in seconds, with no rebuild of the app bundle.
 *
 * Resolution order:
 *   1. /backend.json  { "url": "https://....trycloudflare.com" }
 *   2. VITE_API_URL   (build-time, for a fixed host)
 *   3. relative       (local dev through the Vite proxy)
 */
let BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

/**
 * Reads the runtime backend URL. Called once before the app renders; failures
 * are non-fatal and simply leave the build-time default in place.
 */
export async function loadBackendConfig(): Promise<void> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}backend.json`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return;
    const cfg = (await res.json()) as { url?: string | null };
    if (cfg?.url) BASE = cfg.url.replace(/\/+$/, '');
  } catch {
    /* offline, missing file, or slow network — keep the build-time default */
  }
}

/** Absolute URL for a backend path, e.g. api('/api/chat') or api('/audio/x.mp3'). */
export function api(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/** True when the app is pointed at a remote backend rather than a local one. */
export const hasRemoteBackend = () => BASE.length > 0;

/**
 * Headers every backend request should carry.
 *
 * localtunnel serves a "click to continue" interstitial to anything that looks
 * like a browser, which would turn our fetches into HTML instead of JSON. This
 * header opts out of it, and is simply ignored by every other tunnel or host.
 */
export const apiHeaders: Record<string, string> = {
  'bypass-tunnel-reminder': 'true',
  'ngrok-skip-browser-warning': 'true',
};
