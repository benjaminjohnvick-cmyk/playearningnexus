# AI Moderation & DMCA — how they fit together

*AI moderation is the moderation **layer**. The registered DMCA agent is a separate **legal registration**. This doc explains what we built, and why one does not replace the other.*

**The key point, stated plainly:** AI moderation cannot legally replace the DMCA safe harbor. They do different jobs. AI moderation *catches* illegal/infringing/harmful content fast; the DMCA safe harbor is a legal status you earn by registering a designated agent, running notice-and-takedown, and terminating repeat infringers. We built strong AI moderation **and** wired it to feed the DMCA repeat-infringer policy — so they work together. The registered agent is still required; it's a ~$6 Copyright Office filing, not something software removes.

---

## What the AI moderation layer does (built)

Every hosted-session content signal runs through moderation before/while it's live. It's **rules-first, then AI** (so it's cheap):

- **Rules-first (free):** obvious-bad content (scam patterns, banned terms) is blocked with no model call; obvious-fine content passes with no model call. This is `moderateText` from `rules-first.ts`.
- **AI for the ambiguous middle:** only content the rules can't decide goes to the **cheap Llama tier** (`modelForJob("routine")`), which classifies it into categories (illegal, infringing, sexual, violence, hate, harassment, scam) with a severity.
- **Kill-switch:** a **block** immediately ends the session (`HOSTING_MODERATION_KILL_ON_BLOCK`) and clears its broadcast.
- **Viewer reporting:** any viewer can **Report** a stream; at `HOSTING_MODERATION_REPORT_THRESHOLD` distinct reports (default 3) the session auto-suspends pending review.
- **Repeat-infringer strikes:** each block and each upheld DMCA takedown records a **strike** against the host. At `HOSTING_REPEAT_INFRINGER_STRIKES` (default 3) the host is **barred from hosting** — enforced at go-live.
- **Vision (frames):** the pipeline accepts periodic video frames for AI review, gated behind `HOSTING_MODERATION_VISION_ENABLED` — a safe no-op until a vision model is configured. Text/metadata moderation runs regardless.

Endpoints: `sessionModerationScan` (scan + enforce), `sessionReport` (viewer report), `hostModerationStatus` (posture + a host's strikes), and the audit trail lives in the new `HostModerationEvent` entity. Public **broadcast requires moderation on** (`sessionBroadcastStart` refuses otherwise).

## What the DMCA side requires (not replaceable by AI)

To keep safe harbor under 17 U.S.C. § 512, we still need all of:

1. **A registered designated agent** with the U.S. Copyright Office (fields: `DMCA_AGENT_NAME`, `DMCA_AGENT_EMAIL`, `DMCA_AGENT_ADDRESS`). This is the ~$6 filing. **AI does not do this.**
2. **Notice-and-takedown** — already built: `dmcaTakedownRequest` accepts a §512(c)(3) notice, records it (`DMCARequest`), flags/removes the content, and emails the agent. It now also **ends the targeted live session and strikes the host**.
3. **A repeat-infringer termination policy** — this is exactly what the strike system above enforces. AI moderation *powers* this policy; it doesn't replace the obligation.

## How they connect

```
content → rules-first → (ambiguous?) → AI (cheap Llama) → block? → kill stream + STRIKE host
viewers → Report → threshold → suspend session
rights holder → dmcaTakedownRequest → remove + email agent + STRIKE host
                                   STRIKES ≥ limit → host barred (repeat-infringer termination)
```

The strike count is the shared spine: AI blocks, viewer-driven suspensions, and DMCA takedowns all feed it, and it enforces the termination policy the safe harbor requires. So AI moderation makes the DMCA process faster and the repeat-infringer policy automatic — while the registered agent remains a separate, required, inexpensive step.

---

## What to tell counsel

The question is not "can AI replace DMCA?" (it can't) but: **"we run AI moderation as the moderation layer + a registered DMCA agent with notice-and-takedown and an automated repeat-infringer strike policy — is that sufficient for safe harbor at broadcast scale?"** That is the question in `LIVESTREAM-ADVERTISING-COUNSEL-BRIEF.md` (§3). All of this stays gated off (`SESSION_HOSTING_ENABLED`) until counsel clears it.

*Verified by the load test (`deploy-kit/load-test.mjs`, §7): rules-first→AI scanning, blocks strike + kill, report threshold suspends, repeat-infringer bar at the limit, broadcast requires moderation, and the DMCA takedown still strikes the host.*
