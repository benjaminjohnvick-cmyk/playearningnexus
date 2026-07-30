import React from 'react';
import { Mic } from 'lucide-react';

/**
 * VoiceInputHint — a tiny, reusable affordance that reminds users they can SPEAK instead of type by
 * tapping their phone keyboard's own mic button. That dictation is done by the operating system for FREE
 * (we never touch audio, no server transcription), so "voice input" costs nothing and needs no code beyond
 * making it discoverable. Drop this next to any text input.
 */
export default function VoiceInputHint({ className = '', label = 'Tip: tap the mic on your keyboard to speak instead of typing' }) {
  return (
    <div className={`flex items-center gap-1 text-[11px] text-gray-400 ${className}`}>
      <Mic className="h-3 w-3" />
      <span>{label}</span>
    </div>
  );
}
