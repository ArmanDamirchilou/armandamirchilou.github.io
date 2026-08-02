import { useState, useCallback, useRef, useEffect } from 'react';
import { LipSyncAnalyzer } from '../systems/LipSync';

export function useAudio() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyzerRef = useRef<LipSyncAnalyzer>(new LipSyncAnalyzer());
  const rafRef = useRef<number>(0);
  const volumeRef = useRef(1);

  // Set voice volume (0..1). Applies live to whatever is currently playing.
  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    volumeRef.current = clamped;
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
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

  const playAudio = useCallback((url: string) => {
    return new Promise<void>((resolve) => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
      }

      const audio = new Audio(url);
      audio.volume = volumeRef.current;
      audioRef.current = audio;

      audio.addEventListener('canplaythrough', () => {
        analyzerRef.current.connectAudioElement(audio);
        setIsSpeaking(true);
        audio.play().catch(() => {
          setIsSpeaking(false);
          resolve();
        });
      }, { once: true });

      audio.addEventListener('ended', () => {
        setIsSpeaking(false);
        setAudioLevel(0);
        resolve();
      }, { once: true });

      audio.addEventListener('error', () => {
        setIsSpeaking(false);
        setAudioLevel(0);
        resolve();
      }, { once: true });
    });
  }, []);

  const speakWithBrowserTTS = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = volumeRef.current;

      // Simulate audio levels for browser TTS
      let interval: ReturnType<typeof setInterval>;

      utterance.onstart = () => {
        setIsSpeaking(true);
        interval = setInterval(() => {
          setAudioLevel(0.3 + Math.random() * 0.4);
        }, 80);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setAudioLevel(0);
        clearInterval(interval);
        resolve();
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setAudioLevel(0);
        clearInterval(interval);
        resolve();
      };

      speechSynthesis.speak(utterance);
    });
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    speechSynthesis.cancel();
    setIsSpeaking(false);
    setAudioLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      stopAudio();
      analyzerRef.current.dispose();
    };
  }, [stopAudio]);

  return { isSpeaking, audioLevel, volume, setVolume, playAudio, speakWithBrowserTTS, stopAudio };
}
