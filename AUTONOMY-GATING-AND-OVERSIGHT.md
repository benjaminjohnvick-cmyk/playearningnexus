# Autonomy Gating + Exception Oversight — Implementation Note

*What shipped this build toward the goal of a business that runs itself: a reusable **gate** that routes any
operational action through the Autonomy Kernel so it can earn autonomy, and an **exception-based oversight
dashboard** so a human watches only what needs attention. Current as of 2026-09-08. Not legal advice — the
permanent gates below are a compliance posture for counsel to confirm.*

---

## 1. The gate — `backend/sdk/autonomy-gate.ts`

The principle from the design map: *a task can only become autonomous later if it flows through the kernel
today.* This is the primitive that makes that one line of code at any action site.

```ts
import { gateAndRun } from "../../sdk/autonomy-gate.ts";

await gateAndRun("content_calendar",
  { subjectId: schedule.id, summary: "Auto-approve 3 posts for today", reversible: true },
  async () => { /* the actual action */ });
```

What it does, every time:

1. **Computes the domain's live trust** from stored history — approved runs, agreement with the human, data
   sample — exactly as `autonomyDecide` does.
2. **Asks the kernel** whether it may act now, then applies three hard walls in `classifyGate` (a pure,
   unit-tested function): a **permanent-gate** domain never runs; an **irreversible** action never runs; the
   **global brake** (kill switch / AI-paused / not-live) blocks; only then does the kernel's own
   auto/earned/manual decision govern.
3. **Either runs the action** — recording it as an auto-applied, reversible `AutonomyDecision` and to the live
   feed (`logAiAction`) — **or queues it** for the human overseer (an `AutonomyDecision` marked
   `awaiting_approval` **plus** an `AutomationReview` inbox row).
4. **Records an `AutonomyDecision` either way**, so every gated action feeds the trust ledger and the domain
   graduates on the same rules everywhere.

It **fails closed**: any internal error means *not executed* (queued), never a throw into the caller. And it
carries an `undoRef` so an auto-applied action stays reversible from the oversight view.

**Live wirings so far** (each previously acted unconditionally; each now graduates through its domain, with a
safe fallback of "queue for the overseer" when not yet earned):

- `autoPublishContentCalendar` → **content_calendar** — auto-approving scheduled posts.
- `autoActivityFeedPersonalizer` → **personalization_home** — the daily personalized-recommendation refresh.
- `adGridReallocateSlots` → **ad_optimization** — reallocating unused premium ad slots within the daily cap.
- `advertiserWeeklyReport` also routes its writer through the model router's `document` job (see the model-module note).

Each is the same one-line pattern (`gateAndRun("<domain>", …, run)`), so routing the remaining operational
sites is mechanical, one action at a time.

## 2a. Coverage — measuring "how much of the loop is routed"

The oversight endpoint reports **coverage** over the domains that are actually worth gating. Each `auto_ok`
domain carries two static flags on the domain map: **`gateable`** (it has a discrete, reversible, autonomous
action worth routing) and **`wired`** (the code routes an action through `gateAndRun` today). Coverage =
`gateable_wired / gateable_total`, shown as the **"Loop routed" %** tile and a per-domain dot (emerald = routed,
ringed = also live, grey = gateable-not-yet-wired, faint = non-gateable by design).

Crucially, non-gateable domains are **excluded with a documented reason** rather than counted as gaps, because
gating them would be theater: read-only reporting/monitoring (`analytics_report`, `ops_monitor`,
`doc_generation`), on-demand/user-initiated actions (`creative`), run-at-signup flows (`onboarding`), work
governed by a separate mechanism (`video` autopilot), continuous ranking with no discrete apply (`matching`),
enforcement that belongs on a real gate (`moderation_triage` → `account_action`), features that don't exist yet
(`seo_metadata`), or actions already covered elsewhere (`recommendation` → `personalization_home`, `social`'s
opt-in/#ad gate, `pricing_experiment`'s review flow).

**The gateable set is the reversible operational loop: `content_calendar`, `personalization_home`,
`ad_optimization`, `catalog`, and `survey` — all five wired, so coverage reads 100%.** The meter is *static*
(measured from code, not runtime traffic), so it reflects real wiring even before launch; the per-domain dot's
ring separately shows which have actually fired. Adding a genuinely new autonomous action later means adding a
gateable domain and wiring it — the meter would then show the new work as the gap to close.

## 2. The exception dashboard — `autonomyOversight` + `AutonomyOversight.jsx`

The interface an autonomous business is actually run from: not "approve everything," but "what needs me?"

The endpoint (`backend/functions/autonomyOversight/entry.ts`, admin) makes **one bounded pull** of recent
decisions + the pending queue + the global brakes, then returns:

- **Global brakes** — autonomy on/off, kill switch, AI-paused, the live auto-apply mode + reason, and AI spend
  vs the daily cap.
- **A ranked exceptions feed** (the point of the page): the kill switch or a pause being on; **auto-actions that
  failed**; approvals **stale** in the queue past a configurable window (`AUTONOMY_PENDING_STALE_HOURS`, default
  24h); domains **not earning trust** (agreement below the bar); spend near the cap; and permanent-gate items
  awaiting a human. Ranked Critical → Info.
- **A per-domain trust grid** — each domain's mode, agreement, approved runs, and applied/waiting/failed counts.
- **The pending-approval queue** — one-tap approve/reject (via `oversightApprove` / `oversightReject`).

The page (`src/pages/AutonomyOversight.jsx`, admin nav "Autonomy Oversight") polls it every 15s. As domains
graduate, you shift from approving items to just watching this feed and tapping the gates — which is exactly the
thin-human-layer operating model.

## 3. How this advances the "runs itself" goal

The reversible operational loop can now be **wired through one gate** and will graduate on evidence, while the
**money / identity / legal / risk spine stays a permanent wall** — `gateAndRun` refuses to auto-run those no
matter how much trust exists, same as the kernel. The oversight dashboard turns the human role from operator to
**exception-handler**. The remaining work to widen autonomy is mechanical: route more action sites through
`gateAndRun` (each becomes a graduating domain), add per-action `undoRef`s for clean reversibility, and — the
non-code part — have counsel confirm the irreducible permanent-gate list for your jurisdiction.

## Files

- **New:** `backend/sdk/autonomy-gate.ts`, `backend/sdk/autonomy-gate.test.ts` (6/6),
  `backend/functions/autonomyOversight/entry.ts` (now with the coverage map), `src/pages/AutonomyOversight.jsx`.
- **Routed through the gate:** `backend/functions/autoPublishContentCalendar/entry.ts` (content_calendar),
  `backend/functions/autoActivityFeedPersonalizer/entry.ts` (personalization_home),
  `backend/functions/adGridReallocateSlots/entry.ts` (ad_optimization).
- **Changed:** `backend/functions/_manifest.json`, `backend/sdk/settings.ts` (`AUTONOMY_PENDING_STALE_HOURS`),
  `src/Layout.jsx` (admin nav entry).

## Related

- `AI-MODEL-MODULE-AND-AUTONOMY-MAP.md` — the model router + the full domain map this builds on.
- Existing: `autonomy-kernel.ts` (trust math), `autonomyStatus` (exact per-domain graduation), `oversight*`
  (approve/reject), `ai-autonomy.ts` (global live gate).

*Not legal advice — the permanent-gate classification is a compliance posture for counsel to confirm.*
