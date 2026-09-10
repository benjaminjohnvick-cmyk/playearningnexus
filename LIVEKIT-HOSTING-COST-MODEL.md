# LiveKit Hosting Cost Model

*Live hosting / screen-share / live-shopping — what it costs to run, and how to plug in your own numbers.*

**Bottom line up front:** Live hosting costs **$0 today.** Every hosting flag ships OFF and is counsel-gated, so nothing streams until your attorney clears the hosting brief and you flip the switch. When it *is* on, the cost is driven almost entirely by **concurrent live viewer-minutes (egress bandwidth)** — **not** by how many users are registered. A platform with 200,000 registered users but nobody watching live costs the same as one with zero users. This doc gives you the unit economics, a plug-in-your-own-numbers calculator, three adoption scenarios at 200K users, the levers already built into the code to cap the bill, and three named hosting providers at different price points.

---

## 1. The one thing that drives the cost

A self-hosted LiveKit SFU (Selective Forwarding Unit) takes one uploaded stream from the host and **forwards a copy to every viewer.** So the server's outbound bandwidth — its **egress** — scales with:

> **(number of concurrent viewers) × (stream bitrate) × (time watched)**

Registered users, signups, page views, catalog size — none of those move this number. Only **people watching a live session at the same time** do. This is why "cost for 200,000 users" is the wrong question to anchor on; the right question is "how many of them are watching live at once, at what quality, for how long."

### The unit: one viewer-hour

A "viewer-hour" (vh) = one person watching one hour of live video. That's the natural billing unit because it maps straight to bandwidth.

At a typical screen-share / live-shopping quality of **~1.5 Mbps**:

```
1.5 Mbps × 3600 s ÷ 8 bits/byte  =  ~675 MB  ≈  0.66 GB egress per viewer-hour
```

So **one viewer-hour ≈ ~0.66 GB of egress.** (Lower the bitrate and this drops linearly — see the levers in §5.)

### What a viewer-hour costs, by host

Egress is priced per GB, and the spread between hosts is enormous:

| Host type | Example providers | ~$/GB egress | Cost per viewer-hour (@0.66 GB) |
|---|---|---|---|
| Cheap / bundled bandwidth | **Hetzner, OVH** | ~$0.01/GB (often bundled free up to a large monthly cap) | **~$0.007/vh** |
| Mid-tier VPS | **Vultr**, DigitalOcean, Linode | ~$0.01–0.02/GB after a bundled allowance | ~$0.007–0.013/vh |
| Hyperscaler baseline | **AWS**, GCP, Azure | ~$0.09/GB | **~$0.06/vh** |

The takeaway: **the same viewer-hour costs roughly 8–9× more on AWS than on Hetzner/OVH.** Your choice of host matters more than almost anything else. There's also a small **TURN relay** overhead — some viewers (behind strict firewalls/NATs, ~10–20%) can't connect peer-optimally and must be relayed through your coturn server, which roughly doubles bandwidth *for those viewers only*. Budget **~+25%** on top of the egress figure to cover it.

---

## 2. The calculator — plug in your own numbers

Fill in the five inputs, run the formula, get your monthly bill. This is deliberately a "spreadsheet on paper" — you can drop it straight into a spreadsheet cell-for-cell.

### Inputs

| Cell | Input | Your value | Notes |
|---|---|---|---|
| **A** | Peak concurrent live viewers | ______ | The most people watching at the same moment |
| **B** | Average concurrent viewers | ______ | Usually 15–30% of peak across a day |
| **C** | Stream bitrate (Mbps) | ______ | ~1.5 default; 0.8 low, 2.5 HD |
| **D** | Live hours per day (platform-wide) | ______ | How many hours *someone* is streaming/day |
| **E** | Egress price ($/GB) | ______ | Hetzner/OVH ~0.01, AWS ~0.09 |

### Formula

```
GB per viewer-hour            =  C × 3600 ÷ 8 ÷ 1000            (≈ 0.66 at C=1.5)
Viewer-hours per month  (VH)  =  B × D × 30
Egress GB per month           =  VH × (GB per viewer-hour)
Bandwidth cost / month        =  Egress GB × E
+ TURN relay (~25%)           =  Bandwidth cost × 0.25
+ SFU server(s)               =  see sizing note below
────────────────────────────────────────────────────────────
MONTHLY TOTAL                 =  Bandwidth + TURN + SFU servers
```

**SFU server sizing note:** one modest VPS (4–8 vCPU, e.g. ~$20–50/mo on Hetzner/OVH/Vultr) comfortably forwards **a few hundred to ~1,000 concurrent viewers** before you add a second box. Rule of thumb: **1 server per ~1,000 peak concurrent viewers (cell A).** So server cost = `ceil(A ÷ 1000) × ~$40/mo`. TURN/coturn can share the box at small scale or get its own ~$20/mo VPS once relay traffic is heavy.

### Worked example rows

Same 1.5 Mbps stream (0.66 GB/vh), 8 live hours/day, on a cheap host ($0.01/GB) unless noted:

| Avg concurrent (B) | VH/mo (B×8×30) | Egress GB/mo | Bandwidth @$0.01 | +TURN 25% | +Servers | **Total/mo** |
|---|---|---|---|---|---|---|
| 5 | 1,200 | ~790 | ~$8 | ~$2 | ~$40 (1 box) | **~$50** |
| 25 | 6,000 | ~3,950 | ~$40 | ~$10 | ~$40 | **~$90** |
| 170 | 40,800 | ~26,900 | ~$270 | ~$67 | ~$40–80 | **~$400–420** |
| 1,460 | 350,400 | ~231,000 | ~$2,310 | ~$580 | ~$80–120 | **~$3,000** |

Now the **same last row on AWS** ($0.09/GB): bandwidth alone becomes ~$20,800 + ~$5,200 TURN → **~$26,000/mo.** That single column swap is the whole argument for picking the host carefully.

> **Tip:** the only inputs that really swing the bill are **B (average concurrent viewers)** and **E ($/GB)**. Peak (A) only sets how many servers you rack; bitrate (C) scales everything linearly and is your cleanest lever (§5).

---

## 3. Three adoption scenarios at 200,000 registered users

To translate "200K users" into the calculator, we assume live-viewing behavior. All figures are **live-video runtime only**, on top of the **~$10–35/mo base app hosting** you already pay, at 1.5 Mbps, and span the cheap-host → AWS range.

| Scenario | Assumption | Avg concurrent viewers | Viewer-hrs/mo | Cheap host (Hetzner/OVH) | AWS baseline |
|---|---|---|---|---|---|
| **Light** | ~0.5% ever go live/watch; thin overlap | ~small | ~2,000 vh | **~$55/mo** | **~$190/mo** |
| **Moderate** | ~5% engage with live; healthy overlap | ~55 | ~40,000 vh | **~$450/mo** | **~$3,200/mo** |
| **Heavy** | ~20% engage; live-shopping is a core habit | ~485 | ~350,000 vh | **~$3,300/mo** | **~$25,000/mo** |

Each figure includes bandwidth + ~25% TURN + SFU servers. Read these as **ranges, not promises** — real cost depends on the actual concurrency, which you won't know until it's live. The pattern to internalize: even in the Heavy case, a cheap host keeps you around **$3–4K/mo**, while the same traffic on AWS is a **$25K/mo** bill. Same product, ~8× difference, purely from where it runs.

---

## 4. Where it sits relative to your current cost docs

Nothing here changes your headline numbers. Live hosting is **$0 at launch** (gated off), so:

- Year-one all-in stays **~$2,900–$4,000**.
- Dev cost stays **$3,000**.
- Base app hosting stays **~$10–35/mo**.

Live hosting only ever becomes a line item **after** counsel clears it and you turn it on — and even then it starts near zero and grows only with actual live concurrency. It is a *usage-driven, opt-in* cost, not a fixed one.

---

## 5. Levers already in the code to cap the bill

You are not exposed to the Heavy-scenario number by default. These controls exist to keep live cost bounded:

- **`HOSTING_UNLOCK_ENABLED`** — gate the ability to *go live* behind an earned threshold (e.g. earn $4/day of activity to unlock hosting). This caps how many people can ever stream, which caps peak concurrency at the source.
- **Bitrate cap (cell C)** — dropping the stream from 1.5 Mbps to 0.8 Mbps nearly **halves** every cost figure above, linearly. Screen-share of a storefront rarely needs HD.
- **Room-size cap** — limit viewers per room so no single session balloons egress.
- **Live-hours cap** — limit hours/day a host can stream (cell D), directly bounding viewer-hours/mo.
- **Resolution/framerate limits** — lower resolution and fps for the same effect as the bitrate cap.
- **Record-to-VOD instead of live** — for content that doesn't need to be live, record once and serve from cheap object storage/CDN, which is dramatically cheaper per view than real-time forwarding.

Turning any of these tighter moves you down and to the left in the scenario table.

---

## 6. Named hosting providers

Three concrete options at different price points for the self-hosted LiveKit SFU + coturn TURN server:

1. **Hetzner** — cheapest bundled bandwidth. Dedicated/VPS boxes include very large monthly traffic allowances at effectively **~$0.01/GB or free up to the cap.** Best cost-per-viewer-hour of the three. EU/US locations.
2. **OVH / OVHcloud** — similar economics to Hetzner, generous bundled/"unmetered" bandwidth tiers, global datacenters. A strong second source so you're not single-vendor.
3. **Vultr** — mid-tier VPS with a bundled traffic allowance per instance and simple per-GB overage; slightly pricier than Hetzner/OVH but with more regions and fast provisioning, useful for placing an SFU close to your users.

**AWS** is listed throughout as the **expensive baseline** — great if you're already all-in on AWS, but its ~$0.09/GB egress makes it 8–9× costlier per viewer-hour than Hetzner/OVH for this specific workload. Use it as the "ceiling" number when you stress-test the budget, not as the default home for live media.

> All three run a standard Linux VPS/dedicated box with root, open UDP, and real egress — exactly what LiveKit needs and what shared/"free" web hosting cannot provide. The **LiveKit API key, secret, and URL must live in server environment variables, never in the client bundle**, on whichever host you pick.

---

*Prices are approximate 2026 figures and move over time — reprice against 2–3 providers before committing, and re-run §2 with your real concurrency once live hosting is switched on. Everything above assumes the hosting flags have been counsel-cleared and enabled; until then, this cost is $0.*
