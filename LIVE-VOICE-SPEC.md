# Live voice-to-voice in buddy chat — spec (NOT built; for your decision)

This is a proposal, not code. Live voice is a bigger infra + legal lift than the async voice notes (already
built), and it can't be moderated the way text and recorded notes can — so it needs your call on the
infrastructure and the consent/recording piece before anything is built.

## Scope (recommended)

**Connected-buddies only.** Live voice is offered ONLY between two buddies who have mutually connected (the
opt-in "connect" that unlocks after earning). Never for strangers or groups — those stay on text + voice
notes, where the answer-wall and anti-scam guard actually work. This mirrors how the voice *notes* are gated.

**Tied to active earning.** The call auto-pauses/ends under the same inactivity rule as chat
(`BUDDY_CHAT_IDLE_SECONDS`, 60s): if a user stops completing surveys, the voice channel drops, and resumes
when they're working again. Voice is a work-companion, not an open line.

## Infrastructure required

Live audio is peer-to-peer streaming, which needs three things the async notes don't:

1. **WebRTC** in the client (getUserMedia + RTCPeerConnection) — real-time mic → peer audio.
2. **A signaling server** — a small websocket service that brokers the connection offer/answer/ICE between
   the two peers. (Serverless websockets or a tiny managed service.)
3. **STUN + TURN servers** — STUN is free/cheap; **TURN relays** are needed when peers are behind
   restrictive NATs/firewalls (a large share of mobile users), and TURN carries the audio, so it costs
   bandwidth. Budget for a managed TURN provider (e.g. metered/coturn) — this is the main ongoing cost.

None of this exists yet; it's net-new services to stand up and pay for.

## The moderation gap (the hard part)

- **Live audio can't be pre-screened.** The answer-wall and scam guard read text; there's no transcript to
  scan before words are spoken. So real-time harassment, answer-collusion, or "let's move to WhatsApp / send
  me money" scams can't be blocked in the moment the way they are in text/notes.
- **Mitigations, none perfect:** (a) connected-only limits it to people who chose each other; (b) record the
  call and run transcription + scam-guard AFTER the fact for review + account action; (c) a prominent
  in-call "Report" that ends + flags immediately; (d) the inactivity auto-drop shortens exposure.
- Even with recording, it's after-the-fact — it deters and enables enforcement, it doesn't prevent the first
  incident.

## Consent & recording (legal — get counsel)

- Recording calls for moderation triggers **two-party (all-party) consent** laws, which vary by US state and
  by country, and get thornier when the two people are in different jurisdictions (cross-border calls).
- Requirement: an explicit, logged **consent-to-record** from BOTH parties before a call connects, plus clear
  disclosure that calls are recorded and retained for safety (add to the privacy policy + a per-call notice).
- Retention: store recordings under the same moderation-only access as chat transcripts (admin-only), with a
  defined retention window; never user-to-user.
- This is a lawyer question before launch — don't ship live recorded calls without a compliance sign-off.

## Data-quality note

Talking live while filling surveys can split attention; distracted answers get screened out or flagged by the
panels (which hurts your data reputation with advertisers). Voice *notes* (async) sidestep this; live calls
don't. Worth weighing against the engagement upside.

## What would get built (once you approve infra + consent)

1. A `voiceCallSignal` websocket function (offer/answer/ICE relay), connected-only, with a per-call
   consent-to-record gate.
2. TURN credentials issued per session (short-lived), from your chosen TURN provider.
3. Client call UI in `BuddyPanel` (call/hang-up, mute), gated on `connect.connected`, auto-dropping on the
   inactivity rule, with a big in-call Report.
4. Post-call: transcribe the recording → scam-guard/answer-wall the transcript → retain for moderation.
5. (Optional, expensive) live translated voice — real-time STT→translate→TTS — deferred; start with the
   translated voice *notes* that already ship.

## Recommendation

Ship and live with the **async translated voice notes** first (built, moderatable, cheap). Consider live
voice only if engagement data justifies the TURN cost and you've cleared the consent-to-record piece with a
lawyer — and even then, keep it connected-buddies-only and inactivity-gated.
