// Nexus scheduler — runs automation functions on cron using Deno.cron. Deploy as a
// separate always-on process (ECS service / Deno Deploy). It calls the backend's
// /functions/<name> with a service token, so it needs BACKEND_URL + a service JWT.
//   deno run --allow-net --allow-env --unstable-cron scheduler/main.ts
import { signJwt } from "../sdk/auth.ts";

const BACKEND = (Deno.env.get("BACKEND_URL") ?? "http://localhost:8000").replace(/\/$/, "");
const SERVICE_USER_ID = Deno.env.get("SCHEDULER_SERVICE_USER_ID") ?? "00000000-0000-0000-0000-000000000001"; // seed admin
const cfg = JSON.parse(await Deno.readTextFile(new URL("./schedules.json", import.meta.url)));

async function invoke(fnName: string) {
  const token = await signJwt(SERVICE_USER_ID, { service: true });
  const res = await fetch(`${BACKEND}/functions/${fnName}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ scheduled: true, action: "run" }),
  });
  console.log(`[cron] ${fnName} → ${res.status}`);
}

for (const job of cfg.jobs) {
  // Deno.cron registers a named cron trigger; the runtime fires the handler on schedule.
  Deno.cron(job.name, job.cron, () => invoke(job.function));
  console.log(`registered ${job.name}: "${job.cron}" → ${job.function}`);
}
console.log(`Scheduler up — ${cfg.jobs.length} jobs, backend ${BACKEND}`);
