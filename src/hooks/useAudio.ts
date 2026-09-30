import { useState, useCallback, useRef, useEffect } from 'react';
import { LipSyncAnalyzer } from '../systems/LipSync';

// 50ms of silence, played inside a user gesture to unlock later playback. It
// must contain real samples: Safari fails to decode a zero-length WAV, and a
// failed play() leaves the element locked.
let silentWav: string | null = null;
function silentWavUrl(): string {
  if (silentWav) return silentWav;
  const rate = 8000;
  const samples = rate / 20;
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const text = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  v.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, 'data');
  v.setUint32(40, samples * 2, true);
  silentWav = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  return silentWav;
}

export function useAudio() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const analyzerRef = useRef<LipSyncAnalyzer>(new LipSyncAnalyzer());
  const rafRef = useRef<number>(0);
  const volumeRef = useRef(1);

  // One element for every clip. Safari only lets an element play without a
  // fresh tap if it was started inside one before, and an element can only be
  // wired into the Web Audio graph (for lip-sync) once — so it's created once,
  // unlocked on the first tap, and reused.
  const elRef = useRef<HTMLAudioElement | null>(null);
  const getEl = useCallback(() => {
    if (!elRef.current) {
      const el = new Audio();
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      elRef.current = el;
      analyzerRef.current.connectAudioElement(el);
    }
    return elRef.current;
  }, []);

  // Resolves whatever playback is in flight. Stopping must settle it too, or
  // the caller awaiting playAudio() would hang with the twin stuck mid-reply.
  const settleRef = useRef<(() => void) | null>(null);

  /** Call from a click/keypress: lets later, non-gesture playback make sound. */
  const unlockAudio = useCallback(() => {
    const el = getEl();
    const ctx = analyzerRef.current.getAudioContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (settleRef.current || !el.paused) return;
    el.src = silentWavUrl();
    el.play().then(() => el.pause()).catch(() => {});
  }, [getEl]);

  // Set voice volume (0..1). Applies live to whatever is currently playing.
  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    volumeRef.current = clamped;
    setVolumeState(clamped);
    if (elRef.current) elRef.current.volume = clamped;
  }, []);

  const updateLevels = useCallback(() => {
    if (!isSpeaking) return;

    const data = analyzerRef.current.update();
    setAudioLevel(data.level);
    rafRef.current = requestAnimationFrame(updateLevels);
  }, [isSpeaking]);

  useEffect(() => {
    if (isSpeaking) {
      rafRef.current = requestAnimationFrame(updateLevels);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isSpeaking, updateLevels]);

  /**
   * Plays a clip; resolves when it ends or is stopped. `onTime` gets the
   * playback position every frame, which is what keeps the captions in step.
   */
  const playAudio = useCallback((url: string, onTime?: (seconds: number, duration: number) => void) => {
    settleRef.current?.();
    return new Promise<void>((resolve) => {
      const el = getEl();
      const ctx = analyzerRef.current.getAudioContext();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      let raf = 0;
      const tick = () => {
        if (settleRef.current !== finish) return;
        onTime?.(el.currentTime, el.duration);
        raf = requestAnimationFrame(tick);
      };
      const onReady = () => {
        if (settleRef.current !== finish) return;
        setIsSpeaking(true);
        el.play().then(() => { if (onTime) tick(); }, finish);
      };
      const finish = () => {
        cancelAnimationFrame(raf);
        el.removeEventListener('canplaythrough', onReady);
        el.removeEventListener('ended', finish);
        el.removeEventListener('error', finish);
        if (settleRef.current !== finish) return;
        settleRef.current = null;
        setIsSpeaking(false);
        setAudioLevel(0);
        resolve();
      };
      settleRef.current = finish;

      el.addEventListener('canplaythrough', onReady, { once: true });
      el.addEventListener('ended', finish, { once: true });
      el.addEventListener('error', finish, { once: true });
      el.volume = volumeRef.current;
      el.src = url;
      el.load();
    });
  }, [getEl]);

  /**
   * The browser's own voice, the last resort. `onChar` gets how much of `text`
   * has been spoken: exact where the browser reports word boundaries, else
   * estimated from a typical speaking rate.
   */
  const speakWithBrowserTTS = useCallback((text: string, onChar?: (chars: number) => void) => {
    settleRef.current?.();
    return new Promise<void>((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = volumeRef.current;

      // Simulate audio levels for browser TTS
      let interval: ReturnType<typeof setInterval> | undefined;
      let spoken = 0;
      let boundaries = false;
      const report = (chars: number) => {
        spoken = Math.max(spoken, Math.min(text.length, chars));
        onChar?.(spoken);
      };
      utterance.onboundary = (e) => {
        boundaries = true;
        report(e.charIndex + (e.charLength || 1));
      };

      const finish = () => {
        clearInterval(interval);
        if (settleRef.current !== finish) return;
        settleRef.current = null;
        setIsSpeaking(false);
        setAudioLevel(0);
        resolve();
      };
      settleRef.current = finish;

      utterance.onstart = () => {
        if (settleRef.current !== finish) return;
        setIsSpeaking(true);
        const started = performance.now();
        interval = setInterval(() => {
          setAudioLevel(0.3 + Math.random() * 0.4);
          // ~14 characters a second at rate 1, for browsers without boundaries.
          if (!boundaries) report(Math.floor(((performance.now() - started) / 1000) * 14));
        }, 80);
      };
      utterance.onend = finish;
      utterance.onerror = finish;

      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    });
  }, []);

  const stopAudio = useCallback(() => {
    const el = elRef.current;
    const settle = settleRef.current;
    // Clear first so the element's own 'error'/'abort' from unloading, and the
    // utterance's onerror from cancel(), can't resolve a later playback.
    settleRef.current = null;
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (settle) {
      settleRef.current = settle;
      settle();
    }
    setIsSpeaking(false);
    setAudioLevel(0);
  }, []);

  useEffect(() => {
    const analyzer = analyzerRef.current;
    return () => {
      stopAudio();
      analyzer.dispose();
    };
  }, [stopAudio]);

  return { isSpeaking, audioLevel, volume, setVolume, playAudio, speakWithBrowserTTS, stopAudio, unlockAudio };
}
