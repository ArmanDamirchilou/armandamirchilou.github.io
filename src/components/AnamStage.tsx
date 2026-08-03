import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createClient, AnamEvent } from '@anam-ai/js-sdk';
import { api } from '../lib/api';

type AnamStatus = 'connecting' | 'live' | 'failed';

export interface AnamStageHandle {
  /** Make the streamed persona speak; resolves false if the stream isn't usable. */
  talk: (text: string) => Promise<boolean>;
}

interface AnamStageProps {
  onStatusChange?: (status: AnamStatus) => void;
}

/**
 * Streams the Anam photoreal persona into a video element. The session token
 * comes from our own server (/api/anam/session-token) so the API key never
 * reaches the browser. Input audio is disabled — the site's own mic + STT
 * pipeline stays in charge of user input. On any failure the parent falls
 * back to the local 3D avatar.
 */
export const AnamStage = forwardRef<AnamStageHandle, AnamStageProps>(function AnamStage(
  { onStatusChange },
  ref
) {
  const clientRef = useRef<ReturnType<typeof createClient> | null>(null);
  const [status, setStatus] = useState<AnamStatus>('connecting');
  const statusCb = useRef(onStatusChange);
  statusCb.current = onStatusChange;

  useEffect(() => {
    let cancelled = false;
    const update = (s: AnamStatus) => {
      if (cancelled) return;
      setStatus(s);
      statusCb.current?.(s);
    };

    (async () => {
      try {
        const r = await fetch(api('/api/anam/session-token'), { method: 'POST' });
        if (!r.ok) throw new Error(`session token request failed (${r.status})`);
        const { sessionToken } = (await r.json()) as { sessionToken: string };
        if (cancelled) return;

        const client = createClient(sessionToken, { disableInputAudio: true });
        clientRef.current = client;
        client.addListener(AnamEvent.SESSION_READY, () => update('live'));
        client.addListener(AnamEvent.CONNECTION_CLOSED, () => update('failed'));

        await client.streamToVideoElement('anam-video');
      } catch (err) {
        console.warn('[Anam] stream unavailable, falling back to 3D avatar:', err);
        update('failed');
      }
    })();

    return () => {
      cancelled = true;
      clientRef.current?.stopStreaming().catch(() => undefined);
      clientRef.current = null;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      talk: async (text: string) => {
        const client = clientRef.current;
        if (!client || !client.isStreaming()) return false;
        try {
          await client.talk(text);
          return true;
        } catch (err) {
          console.warn('[Anam] talk failed:', err);
          return false;
        }
      },
    }),
    []
  );

  return (
    <div className="anam-stage">
      <video id="anam-video" className="anam-video" autoPlay playsInline aria-label="Live video of Arman's AI twin" />
      {status === 'connecting' && (
        <div className="anam-overlay">Connecting to the live persona</div>
      )}
    </div>
  );
});
