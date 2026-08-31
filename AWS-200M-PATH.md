# The one-account path to 200M on AWS (and why stitching free databases isn't it)

You said the goal is simplicity, not saving money: "host 200M without doing anything except upgrade my AWS
account with auto-scaling on." That's achievable, and it's almost exactly that — with the right two AWS products.
The code is already written to point at them, so the moves are configuration, not rewrites.

## The two halves

**1. The app tier — genuinely "turn on auto-scaling."** The backend is stateless, so AWS runs the same code on
as many machines as load needs. Use ECS Fargate (or App Runner) with target-tracking auto-scaling, or EKS with
the Horizontal Pod Autoscaler. You set a CPU/requests target; AWS adds and removes instances automatically. This
is the one-knob thing you're picturing, and it's real for the app tier today. (The scale governor + infra
controller already in the code drive the config side; the cloud auto-scaler does the machine side.)

**2. The database — one managed AWS product that auto-scales.** A plain RDS Postgres does **not** auto-scale
writes to 200M — that's the wall. The AWS answer is **Aurora**, and there are two shapes:

- **Aurora Serverless v2 (PostgreSQL-compatible):** capacity scales up and down automatically with load, and you
  add Aurora **read replicas** for read scaling (most traffic is reads). This alone carries you very far.
- **Aurora DSQL / Aurora Limitless:** AWS's *distributed* SQL — it shards and scales **horizontally without a
  rewrite**, managed by AWS. This is the "just enable it on AWS" version of sharding, for when a single writer
  is no longer enough. It is Postgres-compatible, so the app's queries keep working.

Either way it's an AWS product you provision and connect — which is exactly your mental model. In this code the
database step is a **connection-string change**: set `DATABASE_URL` to the Aurora writer endpoint and
`DATABASE_REPLICA_URL` to the Aurora reader endpoint, and reads fan out to replicas with zero code changes (the
read/write split is already wired). Adopting Aurora Limitless later is likewise a connection/config move, not a
re-architecture, because every query already funnels through one data layer.

So the honest version of "one action": turn on app-tier auto-scaling, and run the database on Aurora (Serverless
v2 → add read replicas → Aurora Limitless at the extreme). That's the whole path, all inside AWS, all managed.

## Why "stitch many free database hosts together" is the wrong tool — even setting price aside

Free managed Postgres tiers are real and fine to *start* on (Neon, Supabase, Aiven, Railway, CockroachDB
Serverless, Turso, Xata, PlanetScale). But using *many* of them, stitched together, to host one platform's
database works **against** your stated goal:

- It's the opposite of simple. You'd be hand-sharding across providers you don't control, each with tiny
  capacity caps, aggressive idle-suspend, no SLA, and the right to delete free data. You'd be **building and
  operating a distributed-database coordination layer yourself**, across mismatched free tiers — far more work
  than one Aurora, not less.
- It's unsafe for money data. No SLA and no guaranteed backups on a free tier means real risk of losing
  balances — unacceptable for the source of truth.
- It doesn't remove the ceiling. Free tiers are capped precisely so they can't serve production scale; you'd hit
  a dozen small walls instead of building past one.

Since you're not optimizing for price, there's no reason to take on that fragility. One Aurora database is
simpler, safer, and is the thing that actually scales — which is what you're really after.

## Where the device tiers fit

The device tiers already built (reads + compute on the phone, and now peer-hosted game sessions) shave a large
chunk of load off the servers, so the central AWS bill is smaller than "run everything centrally" implies. But
they are an *optimization on top of* the AWS path, not a replacement for it. The money-and-inventory database
stays on Aurora; the devices carry reads, per-user compute, and disposable session hosting.
