// cost-floor.ts — the single source of truth for "run everything at the floor."
//
// Two cost surfaces, both driven to the minimum from day one:
//   1. AI (LLM/STT): default provider is Groq (Meta's Llama on Groq's FREE tier) with the cheap-tier brake ON,
//      so no paid frontier model is ever hit unless an admin deliberately turns it on. Reported by aiFloor().
//   2. Live hosting (LiveKit SFU): live-video EGRESS is the only cost that scales, so we cap bitrate,
//      resolution, framerate, viewers-per-room and live-hours/day — all live by default. Reported by hostingFloor().
//
// Nothing here ENABLES a counsel-gated feature. SESSION_HOSTING_ENABLED stays OFF until your attorney clears it;
// these levers only guarantee that WHEN it is turned on, it runs at the cheapest possible bandwidth.

import { snapBool, snapNumber, snapString } from "./settings.ts";

/** Bytes→GB egress for one viewer watching one hour at a given video bitrate. */
export function gbPerViewerHour(bitrateKbps: number): number {
  // kbps → kilobits/sec × 3600 s ÷ 8 (bits→bytes) ÷ 1e6 (KB→GB, using 1000-based to match host billing).
  return (bitrateKbps * 3600) / 8 / 1e6;
}

export interface HostingFloor {
  mode: boolean;
  maxBitrateKbps: number;
  maxResolution: string;
  maxWidth: number;
  maxHeight: number;
  maxFramerate: number;
  maxViewersPerRoom: number;
  maxLiveHoursPerDay: number;
  unlockGate: boolean;
  preferVod: boolean;
  gbPerViewerHour: number;
}

/** The effective LiveKit hosting cost-floor caps (all live-by-default settings). */
export function hostingFloor(): HostingFloor {
  const mode = snapBool("HOSTING_COST_FLOOR_MODE", true);
  const maxBitrateKbps = Math.max(150, snapNumber("HOSTING_MAX_BITRATE_KBPS", 800));
  const res = snapString("HOSTING_MAX_RESOLUTION", "640x360");
  const m = /^(\d{2,5})\s*[x×]\s*(\d{2,5})$/i.exec(res.trim());
  const maxWidth = m ? Number(m[1]) : 640;
  const maxHeight = m ? Number(m[2]) : 360;
  return {
    mode,
    maxBitrateKbps,
    maxResolution: `${maxWidth}x${maxHeight}`,
    maxWidth,
    maxHeight,
    maxFramerate: Math.max(5, snapNumber("HOSTING_MAX_FRAMERATE", 15)),
    maxViewersPerRoom: Math.max(1, snapNumber("HOSTING_MAX_VIEWERS_PER_ROOM", 50)),
    maxLiveHoursPerDay: Math.max(0, snapNumber("HOSTING_MAX_LIVE_HOURS_PER_DAY", 4)),
    unlockGate: snapBool("HOSTING_UNLOCK_ENABLED", true),
    preferVod: snapBool("HOSTING_PREFER_VOD", true),
    gbPerViewerHour: gbPerViewerHour(maxBitrateKbps),
  };
}

export interface AiFloor {
  provider: string;
  onLlamaFreeTier: boolean;
  forceCheapTier: boolean;
  smallModel: string;
  largeModel: string;
  sttProvider: string;
  everythingThatCanRunsOnLlama: boolean;
}

/** The effective AI floor: is every job that CAN run on Llama actually routed to Llama's free tier? */
export function aiFloor(): AiFloor {
  const provider = snapString("LLM_PROVIDER", "groq");
  const onLlama = provider === "groq"; // Groq serves Meta's Llama on its free tier
  return {
    provider,
    onLlamaFreeTier: onLlama,
    forceCheapTier: snapBool("AI_FORCE_CHEAP_TIER", true),
    smallModel: snapString("GROQ_MODEL_SMALL", "llama-3.1-8b-instant"),
    largeModel: snapString("GROQ_MODEL_LARGE", "llama-3.3-70b-versatile"),
    sttProvider: snapString("PROVIDER_STT", "groq"),
    // On Groq, even the "frontier" tier alias resolves to Llama-70B (integrations.ts), so NO paid model is ever
    // hit — i.e. every job that can run on Llama does. If someone points the provider at a paid vendor, this
    // is false and the report flags it.
    everythingThatCanRunsOnLlama: onLlama,
  };
}

/** Combined day-one cost-floor report (for the costFloorStatus admin endpoint + the load test). */
export function costFloorReport() {
  const ai = aiFloor();
  const host = hostingFloor();
  return {
    at: new Date().toISOString(),
    ai,
    hosting: host,
    notes: [
      ai.onLlamaFreeTier
        ? `AI: every job runs on Meta's Llama via Groq's free tier (${ai.smallModel} / ${ai.largeModel}) — projected LLM spend ≈ $0.`
        : `AI: provider is "${ai.provider}" — NOT the free Llama tier. Set LLM_PROVIDER=groq to floor AI cost to $0.`,
      host.mode
        ? `Hosting: cost-floor mode ON — ${host.maxBitrateKbps} kbps / ${host.maxResolution} / ${host.maxFramerate} fps, ≤${host.maxViewersPerRoom} viewers/room, ≤${host.maxLiveHoursPerDay} h/day. ~${host.gbPerViewerHour.toFixed(3)} GB per viewer-hour.`
        : `Hosting: cost-floor mode OFF — streams are uncapped (more expensive).`,
      "Live hosting stays counsel-gated (SESSION_HOSTING_ENABLED off) — these caps make it cheap the moment it is cleared, they do not enable it.",
    ],
  };
}
