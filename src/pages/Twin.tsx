import { useCallback, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AvatarScene } from '../components/AvatarScene';
import { ChatInterface } from '../components/ChatInterface';
import { Modal } from '../components/Modal';
import { VolumeControl } from '../components/VolumeControl';
import { useChat, isLocalHost } from '../hooks/useChat';
import { useAudio } from '../hooks/useAudio';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { Seo } from '../components/Seo';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '../styles/glass.css';
import '../styles/twin-v2.css';
import { Aurora } from '../v2/Aurora';
import { ThemeToggle } from '../v2/theme';
import { api, apiHeaders } from '../lib/api';
import { splitForSpeech } from '../lib/speech';
import { stripLinks } from '../lib/links';
import { charsThroughWord, findSpeech, locateChunks, normalize, wordStarts, wordsSpokenAt, type SpeechSpan } from '../lib/captions';
import type { Caption } from '../components/ChatInterface';

type Emotion = 'neutral' | 'happy' | 'thinking' | 'surprised' | 'concerned';

/** A downloaded voice clip, and where the speech in it is (null if unknown). */
type Clip = { url: string; speech: SpeechSpan | null };

/**
 * Decodes a clip to find where its speech and pauses are, for the captions.
 * Offline, so it needs no user gesture and never touches playback.
 */
async function analyseSpeech(blob: Blob): Promise<SpeechSpan | null> {
  try {
    const ctx = new OfflineAudioContext(1, 1, 16000);
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
    return findSpeech(audio.getChannelData(0), audio.sampleRate);
  } catch {
    return null;
  }
}

const GlobeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.7-3.8-9S9.5 5.5 12 3Z" />
  </svg>
);

const WaveIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
    <path d="M3 12h2M7 8v8M11 4v16M15 7v10M19 10v4M21 12h.01" />
  </svg>
);

const MicIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <rect x="9" y="2.5" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8.5 21.5h7" />
  </svg>
);

/**
 * The twin is Arman's own rigged ARKit model speaking with his locally-cloned
 * voice. Adds: a welcome notice on entry, an English-only gate on the first
 * type/mic action, a live voice-volume control, and a fixed layout where only
 * the message list scrolls.
 */
export function Twin() {
  const [emotion, setEmotion] = useState<Emotion>('neutral');
  const { isSpeaking, audioLevel, volume, setVolume, playAudio, speakWithBrowserTTS, stopAudio, unlockAudio } = useAudio();

  // Each reply gets a run number; stopping bumps it, so a voice clip that is
  // still being synthesised when the user interrupts is dropped, not played.
  const speechRunRef = useRef(0);
  const speakAbortRef = useRef<AbortController | null>(null);
  const [isVoicing, setIsVoicing] = useState(false);

  // The reply being spoken is written out in step with the voice: `chars` is
  // how much of it (normalized) has been said. null once it's all shown.
  const [caption, setCaption] = useState<Caption | null>(null);
  const showCaption = useCallback((id: string, chars: number) => {
    setCaption((c) => (c && c.id === id && c.chars >= chars ? c : { id, chars }));
  }, []);

  const stopSpeaking = useCallback(() => {
    speechRunRef.current++;
    if (speakAbortRef.current) {
      speakAbortRef.current.abort();
      // The server prepares a reply's sentences ahead of time; tell it to
      // stop, so the voice engine isn't busy with lines nobody will hear.
      fetch(api('/api/speak/cancel'), { method: 'POST', headers: apiHeaders, keepalive: true }).catch(() => {});
    }
    speakAbortRef.current = null;
    stopAudio();
    // Cut off mid-sentence, the rest of the reply is still worth reading.
    setCaption(null);
    setIsVoicing(false);
    setEmotion('neutral');
  }, [stopAudio]);

  const handleResponse = useCallback(
    async (data: { id: string; text: string; audioUrl: string | null; useBrowserTTS: boolean }) => {
      const run = ++speechRunRef.current;
      // Heard and captioned without link syntax; the chat shows the links
      // once the reply has been said.
      const reply = normalize(stripLinks(data.text));
      // Set before the first await, so the reply never flashes up in full.
      setCaption({ id: data.id, chars: 0 });
      setEmotion('happy');
      setIsVoicing(true);

      const done = () => {
        if (run !== speechRunRef.current) return;
        setCaption(null);
        setIsVoicing(false);
        setEmotion('neutral');
      };

      const ctrl = new AbortController();
      speakAbortRef.current = ctrl;

      // Clips are downloaded with fetch, not handed to <audio> as a URL: a
      // media element can't send the header that gets past a hosting proxy's
      // "preview warning" page (Daytona serves real browsers that HTML page in
      // place of the WAV). A blob URL is also same-origin, so lip-sync can read
      // it without CORS. The backend returns a site-relative path, which lives
      // on the backend host, not on the static host serving this page.
      const loadClip = async (path: string): Promise<Clip | null> => {
        const r = await fetch(api(path), { headers: apiHeaders, signal: ctrl.signal });
        const blob = await r.blob();
        if (!r.ok || !blob.type.startsWith('audio/')) return null;
        return { url: URL.createObjectURL(blob), speech: await analyseSpeech(blob) };
      };

      // Plays one clip of the reply (`from`..`to` in it), writing its words
      // into the chat as they're said.
      const playClip = async (clip: Clip, from: number, to: number) => {
        const text = reply.slice(from, to);
        const words = text.split(' ').filter(Boolean);
        let starts: number[] | null = null;
        try {
          await playAudio(clip.url, (t, duration) => {
            if (run !== speechRunRef.current) return;
            starts ??= wordStarts(words, clip.speech, Number.isFinite(duration) ? duration : 0);
            showCaption(data.id, from + charsThroughWord(text, wordsSpokenAt(starts, t)));
          });
        } finally {
          URL.revokeObjectURL(clip.url);
        }
        if (run === speechRunRef.current) showCaption(data.id, to);
      };
      const speakFallback = async (from: number) => {
        await speakWithBrowserTTS(reply.slice(from), (chars) => {
          if (run === speechRunRef.current) showCaption(data.id, from + chars);
        });
      };

      if (data.audioUrl) {
        const clip = await loadClip(data.audioUrl).catch(() => null);
        if (run !== speechRunRef.current) return;
        if (clip) await playClip(clip, 0, reply.length);
        else await speakFallback(0);
        return done();
      }
      if (data.useBrowserTTS) {
        await speakFallback(0);
        return done();
      }

      // The reply is voiced sentence by sentence: the first clip is short, so
      // the twin starts talking quickly, and the next one is synthesised while
      // the current one plays. If a clip fails, the browser's own voice
      // finishes the rest rather than leaving the twin silent.
      const fetchClip = async (text: string): Promise<Clip | null> => {
        const timer = setTimeout(() => ctrl.abort(), 45000);
        try {
          const r = await fetch(api('/api/speak'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...apiHeaders },
            body: JSON.stringify({ text }),
            signal: ctrl.signal,
          });
          if (!r.ok) return null;
          const s = (await r.json()) as { audioUrl: string | null; useBrowserTTS: boolean };
          return s.useBrowserTTS || !s.audioUrl ? null : await loadClip(s.audioUrl);
        } catch {
          return null;
        } finally {
          clearTimeout(timer);
        }
      };

      const chunks = splitForSpeech(reply);
      const spans = locateChunks(reply, chunks);
      let next = chunks.length ? fetchClip(chunks[0]) : null;
      for (let i = 0; i < chunks.length && next; i++) {
        const clip = await next;
        if (run !== speechRunRef.current) {
          if (clip) URL.revokeObjectURL(clip.url);
          return;
        }
        next = i + 1 < chunks.length ? fetchClip(chunks[i + 1]) : null;
        if (clip) {
          await playClip(clip, spans[i].from, spans[i].to);
        } else {
          next = null;
          await speakFallback(spans[i].from);
        }
        if (run !== speechRunRef.current) return;
      }
      if (speakAbortRef.current === ctrl) speakAbortRef.current = null;
      done();
    },
    [playAudio, speakWithBrowserTTS, showCaption]
  );

  const { messages, isLoading, sendMessage } = useChat({ onResponse: handleResponse });


  const handleSendMessage = useCallback(
    async (text: string) => {
      stopSpeaking();
      unlockAudio();
      setEmotion('thinking');
      await sendMessage(text);
    },
    [sendMessage, stopSpeaking, unlockAudio]
  );

  const { isRecording, toggleRecording } = useVoiceInput(handleSendMessage);

  // The twin is a fixed app screen: the document under it mustn't scroll.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('is-twin');
    return () => html.classList.remove('is-twin');
  }, []);

  // Esc interrupts the twin, like cutting someone off mid-sentence; leaving
  // the page must silence it too, including a clip still being synthesised.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stopSpeaking();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      stopSpeaking();
    };
  }, [stopSpeaking]);

  // ── Notices / gates (typing and mic each have their OWN message) ───────────
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const [langOpen, setLangOpen] = useState(false);
  const [micOpen, setMicOpen] = useState(false);
  // Once per visit (in-memory, not persisted) — so each notice reliably shows
  // the first time you open the twin, then stays out of your way.
  const [langAccepted, setLangAccepted] = useState(false);
  const [micAccepted, setMicAccepted] = useState(false);

  // Typing: first time the input is focused this visit, show the "I answer in
  // English" note.
  const handleInputFocus = useCallback(() => {
    if (!langAccepted) setLangOpen(true);
  }, [langAccepted]);

  const acceptLanguage = useCallback(() => {
    setLangAccepted(true);
    setLangOpen(false);
  }, []);

  // Mic: the "speak in English" note shows only the FIRST time you record this
  // visit. After that, tapping records immediately. Tapping while recording stops.
  const handleMicClick = useCallback(() => {
    // Talking to the twin interrupts it — and keeps the mic from hearing it.
    stopSpeaking();
    unlockAudio();
    if (isRecording) { toggleRecording(); return; }
    if (micAccepted) { toggleRecording(); return; }
    setMicOpen(true);
  }, [isRecording, micAccepted, toggleRecording, stopSpeaking, unlockAudio]);

  const acceptMic = useCallback(() => {
    setMicAccepted(true);
    setMicOpen(false);
    setTimeout(() => toggleRecording(), 150);
  }, [toggleRecording]);

  // Poll the backend for both the cloned voice and whether there's a backend
  // at all. A static host has none, so /api/health 404s — keep retrying in dev
  // (the server may just be restarting), but stop once deployed so we don't
  // spam the console with failed requests forever.
  const [voiceLive, setVoiceLive] = useState<boolean | null>(null);
  const [backendUp, setBackendUp] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    let id: ReturnType<typeof setInterval> | undefined;

    const check = async () => {
      try {
        const r = await fetch(api('/api/health'), { headers: apiHeaders });
        if (!r.ok) throw new Error(String(r.status));
        const d = await r.json();
        if (!active) return;
        setBackendUp(true);
        setVoiceLive(d.voiceClone === 'live');
      } catch {
        if (!active) return;
        setBackendUp(false);
        setVoiceLive(false);
        if (id && !isLocalHost()) clearInterval(id);
      }
    };

    check();
    id = setInterval(check, 8000);
    return () => {
      active = false;
      if (id) clearInterval(id);
    };
  }, []);

  // The wallpaper swells with the voice; a ref, so it never re-renders React.
  const voiceEnergy = useRef(0);
  voiceEnergy.current = isSpeaking ? 0.35 + audioLevel * 0.65 : isLoading ? 0.2 : 0;

  const status = isSpeaking ? 'speaking' : isLoading ? 'thinking' : 'idle';
  const statusLabel = isSpeaking ? 'Speaking' : isLoading ? 'Thinking' : 'Listening';

  return (
    <div className="twin-page is-dark">
      <Seo
        title="AI Twin — talk to a digital Arman Damirchilou"
        description="A real-time 3D avatar of Arman Damirchilou that answers in his cloned voice: local voice model, LLM reasoning and live facial animation."
        path="/twin"
      />
      <Aurora energy={voiceEnergy} />
      <header className="twin-topbar">
        <Link to="/" className="twin-back" aria-label="Back to the site">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m15 5-7 7 7 7" />
          </svg>
          <span>Arman Damirchilou</span>
        </Link>
        <div className="twin-topbar-title">
          <span className="twin-topbar-name">The AI Twin</span>
          <span className={`voice-pill ${voiceLive ? 'live' : ''}`}>
            {voiceLive
              ? 'Voice live'
              : backendUp === false
                ? 'Voice offline'
                : voiceLive === false
                  ? 'Voice warming up'
                  : 'Connecting'}
          </span>
        </div>
        <div className="twin-topbar-end">
          <ThemeToggle />
          <Link to="/" className="twin-exit">Close</Link>
        </div>
      </header>

      <main className="twin-layout">
        {/* Stage — Arman's rigged 3D twin */}
        <section
          className={`twin-stage-full ${status}`}
          style={{ '--level': audioLevel.toFixed(2) } as React.CSSProperties}
        >
          <span className="twin-glow" aria-hidden>
            <i />
            <i className="soft" />
          </span>
          <div className="twin-stage-canvas">
            <AvatarScene
              isSpeaking={isSpeaking}
              isThinking={isLoading}
              audioLevel={audioLevel}
              emotion={emotion}
              framing="closeup"
              offsetRight={false}
            />
          </div>

          <VolumeControl volume={volume} onChange={setVolume} />

          <div className={`twin-status ${status}`}>
            <span className="twin-status-dot" />
            {statusLabel}
          </div>

          {(isSpeaking || isVoicing) && (
            <button type="button" className="twin-stop" onClick={stopSpeaking} aria-label="Stop talking (Esc)">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              Stop
            </button>
          )}
        </section>

        {/* Chat */}
        <section className="twin-chat-panel">
          {backendUp === false && (
            <div className="twin-offline-note" role="status">
              <strong>The twin can't talk from here.</strong>
              <span>
                {isLocalHost()
                  ? 'The backend on port 3001 is not responding. Start it with npm run dev, then reload.'
                  : "His brain and cloned voice run on a server that isn't part of this static site. The 3D avatar is live — the conversation isn't."}
              </span>
            </div>
          )}
          <ChatInterface
            messages={messages}
            caption={caption}
            isLoading={isLoading}
            isSpeaking={isSpeaking}
            onSendMessage={handleSendMessage}
            onVoiceInput={handleMicClick}
            isRecording={isRecording}
            onInputFocus={handleInputFocus}
          />
        </section>
      </main>

      {/* Welcome notice — shown on entering the Digital Twin */}
      <Modal
        open={welcomeOpen}
        onAccept={() => { unlockAudio(); setWelcomeOpen(false); }}
        accent="azure"
        icon={WaveIcon}
        eyebrow="Welcome to my twin"
        title="Hey, I'm Arman's twin"
        acceptLabel="Let's talk"
      >
        I think with an AI model and speak in Arman's cloned voice, so every
        answer is fresh. My words appear in the chat as I say them. Turn your
        sound on and ask me anything.
      </Modal>

      {/* Typing gate — its own message about answering in English */}
      <Modal
        open={langOpen}
        onAccept={acceptLanguage}
        accent="coral"
        icon={GlobeIcon}
        eyebrow="Before you type"
        title="I answer in English"
        acceptLabel="Got it — continue"
      >
        Type your question in <strong>English</strong> — that's the only
        language I can understand and reply in for now. Persian and more are
        on the way.
      </Modal>

      {/* Mic gate — its own message about speaking in English */}
      <Modal
        open={micOpen}
        onAccept={acceptMic}
        accent="indigo"
        icon={MicIcon}
        eyebrow="Before you record"
        title="Please speak in English"
        acceptLabel="Start recording"
      >
        The voice input only understands <strong>English</strong> right now, so
        please speak in English. Tap <strong>Start recording</strong> and I'll
        begin listening.
      </Modal>
    </div>
  );
}
