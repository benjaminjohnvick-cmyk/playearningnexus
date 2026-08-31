# Using users' devices to cut server cost — the three safe tiers

The recurring goal has been "use people's devices instead of paying for it all centrally." That's a good
instinct, and there's a lot of it we can do — the key is matching the *kind* of work to what a device can safely
own. The dividing line is the same one multiplayer games already use: a player's machine can host the **match**
(throwaway state), but your **account, money, and inventory** always live on central servers. Ephemeral,
low-stakes state can go on the device; the authoritative source of truth cannot.

Here are the three tiers, in the order we built them.

## Tier 1 — Device reads (built)

The device keeps a local copy of the user's **own** data and the **public** catalog (`src/lib/local-db.js`,
IndexedDB). `offlineFirstRead()` serves these instantly and revalidates in the background; `prefetch()`
downloads the public catalog for offline browsing. Money/identity reads (balances, payouts, tax, KYC) are on a
denylist and always come live from the server. **Effect:** the app feels instant and read load drops off the
server. The device is a fast read copy that syncs from the server — never the source of truth.

## Tier 2 — Device compute (built)

The expensive thing at scale isn't storage, it's **compute** — the per-user work the server grinds through for
everyone. `src/lib/device-compute.js` moves the non-authoritative parts onto the phone, run against the local
catalog copy: catalog **search**, **filtering**, and **personalization ranking** (from an affinity profile built
on-device from the user's own history — nothing personal leaves the phone). **Effect:** each device does its own
share, so this work scales for free as users join. The server stays authoritative and re-validates anything that
matters — real price and availability are confirmed server-side at add-to-cart; on-device ranking is presentation
only and can never move value. Next candidate for this tier: on-device media (thumbnail/preview generation),
which saves the most raw server cost.

## Tier 3 — Device-hosted game sessions (built: foundation)

This is the multiplayer-"listen server" idea applied to the part it fits: the **live play-to-earn game sessions**
and casual multiplayer rooms. A user's device (or a peer among the players) hosts the *session* — the current
round, positions, transient scores, room chat — because that state is throwaway. If the host drops, the session
migrates to another player or ends and **no one loses anything real**, exactly like a player-hosted match.

Built (gated behind `SESSION_HOSTING_ENABLED`):

- `backend/sdk/session-host.ts` — pure `electHost()` (auto-elects the best-connected player to host, else the
  server) and `validateSessionOutcome()` (the trust boundary).
- `backend/functions/sessionHostAssign` — assigns the host and records an authoritative `GameSession`.
- `backend/functions/sessionRewardValidate` — the reward gate: loads the real session, atomically claims it
  (anti-replay), **recomputes** the reward from the reported score with the server's own formula + per-session
  and per-day caps + plausibility checks (min duration, max score/sec, wall-clock sanity), and never trusts the
  client's claimed reward. Crediting stays on the existing gated reward path — this function doesn't move value.
- `src/lib/session-host.js` — the listen-server client: host assignment, host/peer roles, heartbeat, automatic
  **host migration** when a host drops, and reward finalized only via the server. Real-time transport
  (WebRTC/websocket) plugs into a thin `transport` adapter seam.

**Effect:** the compute-heavy, latency-sensitive game hosting comes off your servers for the sessions, while the
money stays provably central — a cheating host can at worst ruin a round, never mint Site Cash.

### Hosting access rules & content (built)

- **Earn-to-unlock** (`HOSTING_UNLOCK_ENABLED`, gated): a user can host only after earning the daily threshold
  (`HOSTING_DAILY_EARN_UNLOCK_USD`, default $4) — any earning counts, including buddy chat, since those all write
  to `DailyEarnings`. The $1/day membership fee (`MEMBERSHIP_DAILY_FEE`) comes out of those same earnings (never a
  card, never a debt), so the unlock "includes" the fee and the user still nets ~$3. `hostingStatus` is the UI
  endpoint that shows today's progress toward the unlock. **Compliance:** this is an unlock *condition*, not an
  income promise — the code never asserts "you will earn $4 in N minutes." Keep any "typical time" copy as an
  estimate.
- **Host anything, not just games** (`HOSTING_ALLOW_NONGAME`, gated, pending moderation): a session's
  `content_type` can be `game` (scored, reward-eligible), `stream`, or `screen` (screen mirroring via the
  browser's `getDisplayMedia` picker). Non-game hosts must accept a content policy at join, and the server
  requires the gate. **This can't literally be "anything"** — real moderation (no illegal/infringing content,
  18+, report/takedown, DMCA) must be wired before enabling public streaming, which is why it ships OFF.
- **Side timer** (`timed` on a session): the client exposes `getElapsedSeconds()` + a tick, so a game shows a
  timer on the side and sessions can be ranked by time for time-based competition.
- **Screen mirroring**: `startScreenShare()` on the client uses the browser's screen picker (the user explicitly
  chooses what to share) and hands the stream to the transport. Same content policy applies.

### Hosting capabilities (per-session, host-selected; each gated)

- **Record & replay** (`HOSTING_RECORDING_ENABLED`) and **save-a-clip** (`HOSTING_CLIPS_ENABLED`): the client
  records a stream with `MediaRecorder` (clips keep a rolling buffer), uploads to object storage, and registers
  metadata via `sessionRecording`. Media never enters the DB. A recording is held **pending moderation** before
  anyone can replay it, and participant consent is required — a screen recording can capture anything.
- **On-demand / late-join** (`HOSTING_ONDEMAND_ENABLED`): late viewers request the host's live feed
  (`requestFeed()` + transport renegotiation).
- **Remote control / co-op** (`HOSTING_REMOTE_CONTROL_ENABLED`): the host hands another player **scoped** control
  via `sessionControl`. The scope is locked to `game_input` — `canGrantControl()` refuses anything touching the
  OS, navigation, account, or money — and it's revocable. `applyRemoteInput()` on the host drops any non-game
  input. Sensitive actions never run in the session path, so co-op control can't reach them.

### Hosting monetization — the invariant

Every money-making mode resolves through `hosting-monetization.ts`, which enforces one rule:
**users only ever receive Site Cash; businesses/sellers are paid real money.** Modes (each gated):

- **Game → skill tournament**: `tournament_sitecash` (Site-Cash entry + Site-Cash prizes) is the compliant
  default. A **real-money** contest (`tournament_cash`) is a *separate, counsel-gated* product — paid-entry cash
  contests are regulated state-by-state, need 18+ and eligibility gating, and conflict with "users only get Site
  Cash," so it's refused unless explicitly enabled and is flagged `needs_counsel`.
- **Virtual content → paid access**: viewers either donate Site Cash (`access_donation`) or complete an
  advertiser-funded survey (`access_survey`). Never a real-money charge to a user.
- **Retail / QVC-style physical products**: `retail_5050` / `live_shopping_5050` — orders in Site Cash, revenue
  AI-tracked and split (default 50/50, `HOSTING_REVENUE_PLATFORM_PCT`). The **business** seller is paid real
  money; a user is paid Site Cash. `revenueSplit()` computes the split; `payoutCurrency(isBusiness)` encodes the
  invariant.

Order-taking and payouts run through the platform's existing retail/revenue pipeline (not rebuilt here) — this
layer decides the *policy* per session; the established order + payout systems move the value.

### Third-party sellers & social simulcast (gated; reuse existing systems)

- **Third-party sellers** (`HOSTING_THIRD_PARTY_SELLERS_ENABLED`): reuses the existing seller onboarding
  (`sellerSignupOneClick`, `sellerActivationStatus`) rather than a new flow. A signed-up business seller can host
  retail / live-shopping sessions and is paid **real money**; users only ever get Site Cash. Real-money payouts
  require the seller's KYC/tax onboarding first.
- **Social simulcast** (`HOSTING_SOCIAL_SIMULCAST_ENABLED`): a hosted livestream is announced/pushed across
  social via the **existing consented one-tap posting + endorser engine** (`autoPostContentToSocial`,
  `social-amplification.ts`) with `#ad` disclosure (`disclosure.ts`). Hard rule carried over: it only ever posts
  to accounts a user explicitly connected and consented to **per post** — never silently, never to accounts that
  aren't the user's own. Announcing/linking the stream works through the existing posting path; true multi-
  platform **video** simulcast (RTMP to YouTube/Facebook/Twitch) additionally needs each account's stream keys,
  which is a real integration to wire when you want live video mirrored (vs. a posted link/clip).

### AI-hosted fallback sessions (advertiser backup; built, gated)

When an advertiser's product isn't converting on social (weak CTR / few conversions despite enough impressions),
`aiHostedFallbackRun` (gated `AI_HOSTED_SESSIONS_ENABLED`) auto-launches a live-shopping session hosted by an
**AI presenter** the advertiser configured for their target demographic — rendered on **Abacus.AI** (the engine
wired earlier this session), monetized as live shopping (buyers pay Site Cash, the **business** is paid real
money, users only get Site Cash). `decideAiHostFallback()` decides when to trigger (enough impressions + weak
CTR/conversions); `buildAiHostBrief()` produces the render prompt with the ad-compliance lines baked in: the host
is **disclosed as AI-generated and #ad**, never impersonates a real person, presents product VALUE only and
never promises results, and "demographic match" is creative tone only — not protected-category targeting. This
ties the session's pieces together: hosting + monetization + the Abacus render engine + advertiser optimization.

### Live-shopping checkout & RTMP simulcast (built)

- **Live-shopping checkout** (`liveShoppingOrder`): places an order from a retail/live-shopping session into the
  **existing** `Order` → `autoOrderFulfillmentAndFundsRelease` pipeline — nothing new moves money. The buyer pays
  **Site Cash** (points, never a debt), the platform's 50% is recorded to the existing revenue ledger
  (`recordRevenue`), and the order is created `pending_ai_fulfillment` so the existing pipeline releases the
  seller's proceeds on delivery. A **business** seller is paid **real money** by that pipeline; a **user** seller
  is credited **Site Cash**; the buyer only ever spends Site Cash. Site Cash is refunded on any failure.
- **RTMP simulcast** (`rtmp-simulcast.ts` + `sessionSimulcast` + `src/lib/rtmp-simulcast.js`): pushes a hosted
  livestream to multiple platforms (YouTube/Facebook/Twitch/custom) at once. Browsers can't emit RTMP, so the
  host's WebRTC media goes to a **media relay** (`SIMULCAST_RELAY_URL` — MediaMTX/LiveKit/ffmpeg worker you
  deploy) which fans it out. **Stream keys are secrets**: our code only ever handles a `stream_key_secret_ref`
  (a secret-manager pointer) — a raw key passed in is refused, and no secret material is written to the DB or
  logs. `buildSimulcastPlan()` validates targets and caps the count; only the session host can start/stop.

## What we do NOT put on a device (ever)

The **authoritative database** — balances, Site Cash, rewards, orders, ad budgets, KYC/identity. Not as storage,
not encrypted-and-scattered, not peer-hosted. A device is user-controlled (it could lie about its own balance),
often offline or wiped (data that lives only on devices is data you lose), and would be holding other users'
private data (a privacy/legal breach). Coordinating money-writes across untrusted, intermittently-connected nodes
is the hardest problem in distributed systems and only blockchains attempt it — which we've ruled out. The
authoritative DB scales the proven server-side way instead (see DB-SCALING-PATH.md: read replica → cache →
offload → shard).

## Net

Tiers 1–3 use people's devices heavily — for reads, for compute, and for hosting the game sessions themselves —
which is most of the cost at scale. The one thing that stays central is the money-and-inventory source of truth,
and that's the one thing that must. This is the same architecture the multiplayer games you're borrowing from
already run.
