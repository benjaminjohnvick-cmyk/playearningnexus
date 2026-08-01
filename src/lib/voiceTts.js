// voiceTts.js — speak a survey question aloud for the voice assistant. Tries the server's ElevenLabs voice
// (natural), and falls back to the browser's built-in speech synthesis (free) when there's no key. The user
// still speaks their OWN answer — this only voices the question.

import { base44 } from '@/api/base44Client';

function browserSpeak(text) {
  return new Promise((resolve) => {
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return resolve(false);
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1;
      u.onend = () => resolve(true);
      u.onerror = () => resolve(false);
      window.speechSynthesis.speak(u);
    } catch { resolve(false); }
  });
}

function playBase64(audioB64, mime) {
  return new Promise((resolve) => {
    try {
      const audio = new Audio(`data:${mime || 'audio/mpeg'};base64,${audioB64}`);
      audio.onended = () => resolve(true);
      audio.onerror = () => resolve(false);
      audio.play().catch(() => resolve(false));
    } catch { resolve(false); }
  });
}

/** Speak `text`. Resolves when playback finishes (or falls back). */
export async function speak(text) {
  if (!text) return false;
  try {
    const res = await base44.functions.invoke('ttsSpeak', { text });
    if (res.data?.provider === 'elevenlabs' && res.data.audio_base64) {
      const ok = await playBase64(res.data.audio_base64, res.data.mime);
      if (ok) return true;
    }
    // 'browser' | 'off' | fallback on any failure
  } catch { /* ignore — fall back */ }
  return browserSpeak(text);
}
