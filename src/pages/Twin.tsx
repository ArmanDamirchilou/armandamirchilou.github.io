import { useCallback, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AvatarScene } from '../components/AvatarScene';
import { ChatInterface } from '../components/ChatInterface';
import { Modal } from '../components/Modal';
import { VolumeControl } from '../components/VolumeControl';
import { useChat } from '../hooks/useChat';
import { useAudio } from '../hooks/useAudio';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { Seo } from '../components/Seo';

type Emotion = 'neutral' | 'happy' | 'thinking' | 'surprised' | 'concerned';

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
  const { isSpeaking, audioLevel, volume, setVolume, playAudio, speakWithBrowserTTS, stopAudio } = useAudio();

  const handleResponse = useCallback(
    async (data: { text: string; audioUrl: string | null; useBrowserTTS: boolean }) => {
      setEmotion('happy');
      if (data.audioUrl && !data.useBrowserTTS) {
        await playAudio(data.audioUrl);
      } else {
        await speakWithBrowserTTS(data.text);
      }
      setEmotion('neutral');
    },
    [playAudio, speakWithBrowserTTS]
  );

  const { messages, isLoading, sendMessage } = useChat({ onResponse: handleResponse });

  const handleSendMessage = useCallback(
    async (text: string) => {
      stopAudio();
      setEmotion('thinking');
      await sendMessage(text);
    },
    [sendMessage, stopAudio]
  );

  const { isRecording, toggleRecording } = useVoiceInput(handleSendMessage);

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
    if (isRecording) { toggleRecording(); return; }
    if (micAccepted) { toggleRecording(); return; }
    setMicOpen(true);
  }, [isRecording, micAccepted, toggleRecording]);

  const acceptMic = useCallback(() => {
    setMicAccepted(true);
    setMicOpen(false);
    setTimeout(() => toggleRecording(), 150);
  }, [toggleRecording]);

  // Poll backend so we can show whether the cloned voice is live.
  const [voiceLive, setVoiceLive] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    const check = () =>
      fetch('/api/health')
        .then((r) => r.json())
        .then((d) => active && setVoiceLive(d.voiceClone === 'live'))
        .catch(() => active && setVoiceLive(false));
    check();
    const id = setInterval(check, 8000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const status = isSpeaking ? 'speaking' : isLoading ? 'thinking' : 'idle';
  const statusLabel = isSpeaking ? 'Speaking' : isLoading ? 'Thinking' : 'Listening';

  return (
    <div className="twin-page">
      <Seo
        title="AI Twin — talk to a digital Arman Damirchilou"
        description="A real-time 3D avatar of Arman Damirchilou that answers in his cloned voice: local voice model, LLM reasoning and live facial animation."
        path="/twin"
      />
      <header className="twin-topbar">
        <Link to="/" className="twin-back">← Arman Damirchilou</Link>
        <div className="twin-topbar-title">
          <span className="twin-topbar-name">The AI Twin</span>
          <span className={`voice-pill ${voiceLive ? 'live' : ''}`}>
            {voiceLive ? 'Voice — live' : voiceLive === false ? 'Voice — warming up' : 'Voice — connecting'}
          </span>
        </div>
        <Link to="/" className="twin-exit">Close</Link>
      </header>

      <main className="twin-layout">
        {/* Stage — Arman's rigged 3D twin */}
        <section className={`twin-stage-full ${status}`}>
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
        </section>

        {/* Chat */}
        <section className="twin-chat-panel">
          <ChatInterface
            messages={messages}
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
        onAccept={() => setWelcomeOpen(false)}
        accent="azure"
        icon={WaveIcon}
        eyebrow="Welcome to my twin"
        title="My voice is still in the studio"
        acceptLabel="Let's talk"
      >
        You're meeting my digital twin early. Right now I'm actively refining my
        voice to make it sound as real and natural as possible — so it'll only
        get better from here. Thanks for stopping by while it's still a
        work in progress.
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
