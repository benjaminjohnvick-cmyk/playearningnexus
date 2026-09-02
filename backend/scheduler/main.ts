// Nexus scheduler — runs automation functions on cron using Deno.cron. Deploy as a
// separate always-on process (ECS service / Deno Deploy). It calls the backend's
// /functions/<name> with a service token, so it needs BACKEND_URL + a service JWT.
//   deno run --allow-net --allow-env --unstable-cron scheduler/main.ts
import { signJwt } from "../sdk/auth.ts";

// Where the scheduler sends its job calls. When it runs INLINE in the web process (the Railway setup), it
// must call the server on localhost over PLAIN HTTP — never the public HTTPS URL. Looping out to the public
// domain leaves the box, adds latency, and fails Deno's TLS check against the edge cert
// ("invalid peer certificate: CaUsedAsEndEntity"). A truly separate scheduler process (ECS/Deno Deploy) has
// no local server, so it falls back to SCHEDULER_BACKEND_URL / BACKEND_URL.
const _inline = (Deno.env.get("SCHEDULER_INLINE") ?? "0") === "1";
const _port = Deno.env.get("PORT") ?? "8000";
const BACKEND = (
  Deno.env.get("SCHEDULER_BACKEND_URL")
  ?? (_inline ? `http://127.0.0.1:${_port}` : (Deno.env.get("BACKEND_URL") ?? "http://localhost:8000"))
).replace(/\/$/, "");
const SERVICE_USER_ID = Deno.env.get("SCHEDULER_SERVICE_USER_ID") ?? "00000000-0000-0000-0000-000000000001"; // seed admin
const cfg = JSON.parse(await Deno.readTextFile(new URL("./schedules.json", import.meta.url)));

async function invoke(fnName: string, extraBody?: Record<string, unknown>) {
  const token = await signJwt(SERVICE_USER_ID, { service: true });
  const res = await fetch(`${BACKEND}/functions/${fnName}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    // A job may carry an optional `body` in schedules.json (e.g. { "dry_run": true }); it is merged in here.
    body: JSON.stringify({ scheduled: true, action: "run", ...(extraBody ?? {}) }),
  });
  console.log(`[cron] ${fnName} → ${res.status}`);
}

for (const job of cfg.jobs) {
  // Deno.cron registers a named cron trigger; the runtime fires the handler on schedule.
  Deno.cron(job.name, job.cron, () => invoke(job.function, job.body));
  console.log(`registered ${job.name}: "${job.cron}" → ${job.function}`);
}

// --- Autonomous AGENT schedules -------------------------------------------------
// Fire agents on cron (not just functions). Agent actions still pass through the
// oversight gate + per-agent cost caps, so scheduled autonomy stays safe.
const agentCfg = JSON.parse(await Deno.readTextFile(new URL("./agent-schedules.json", import.meta.url)));
async function invokeAgent(agentName: string, message: string) {
  const token = await signJwt(SERVICE_USER_ID, { service: true });
  const res = await fetch(`${BACKEND}/agents/${agentName}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ message, context: { scheduled: true } }),
  });
  console.log(`[cron-agent] ${agentName} → ${res.status}`);
}
const agentJobs = agentCfg.agents ?? [];
for (const job of agentJobs) {
  Deno.cron(job.name, job.cron, () => invokeAgent(job.agent, job.message ?? "Scheduled run: act within your permissions."));
  console.log(`registered agent ${job.name}: "${job.cron}" → ${job.agent}`);
}

console.log(`Scheduler up — ${cfg.jobs.length} function jobs + ${agentJobs.length} agent jobs, backend ${BACKEND}`);
