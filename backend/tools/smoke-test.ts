// Smoke-test the running Nexus backend end-to-end. Run AFTER `docker compose up` and
// after loading db/schema.sql + db/seed.sql:
//   deno run --allow-net --allow-env tools/smoke-test.ts
// Optionally set BASE=http://localhost:8000
const BASE = Deno.env.get("BASE") ?? "http://localhost:8000";
let pass = 0, fail = 0;
const results: string[] = [];

async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); pass++; results.push(`  ✓ ${name}`); }
  catch (e) { fail++; results.push(`  ✗ ${name} — ${(e as Error).message}`); }
}
function assert(cond: unknown, msg: string) { if (!cond) throw new Error(msg); }

async function j(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${BASE}${path}`, { headers: { "content-type": "application/json", ...(opts.headers ?? {}) }, ...opts });
  const t = await r.text(); let d; try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  return { status: r.status, data: d };
}

let token = "";

await check("health", async () => {
  const r = await j("/health");
  assert(r.status === 200 && r.data?.ok, "health not ok");
  assert(r.data.functions > 0, "no functions loaded");
});

await check("auth: login admin", async () => {
  const r = await j("/auth/login", { method: "POST", body: JSON.stringify({ email: "admin@nexus.local", password: "admin1234" }) });
  assert(r.status === 200 && r.data?.token, "no token returned");
  token = r.data.token;
});

await check("auth: me", async () => {
  const r = await j("/auth/me", { headers: { authorization: `Bearer ${token}` } });
  assert(r.status === 200 && r.data?.email === "admin@nexus.local", "me mismatch");
  assert(r.data.role === "admin", "role not admin");
});

await check("auth: signup (or login if exists) a test user", async () => {
  const creds = { email: "smoke-user@nexus.local", password: "smokepass123", full_name: "Smoke User" };
  let r = await j("/auth/signup", { method: "POST", body: JSON.stringify(creds) });
  if (r.status === 409) {
    r = await j("/auth/login", { method: "POST", body: JSON.stringify({ email: creds.email, password: creds.password }) });
  }
  assert(r.status === 200 && r.data?.token, "signup/login returned no token");
  assert(r.data?.user?.email === creds.email, "user email mismatch");
});

await check("auth: request-reset returns generic success (no account enumeration)", async () => {
  const known = await j("/auth/request-reset", { method: "POST", body: JSON.stringify({ email: "smoke-user@nexus.local" }) });
  assert(known.status === 200 && known.data?.success, "known email did not return success");
  const unknown = await j("/auth/request-reset", { method: "POST", body: JSON.stringify({ email: "does-not-exist@nexus.local" }) });
  assert(unknown.status === 200 && unknown.data?.success, "unknown email should return the same success (no leak)");
  // NOTE: the real reset token is emailed (only its hash is stored), so the full happy-path
  // reset can't be checked over HTTP alone. To verify end-to-end, use a dev email inbox
  // (e.g. Mailhog) to capture the link, then POST /auth/reset-password with that token.
});

await check("auth: reset-password rejects an invalid token", async () => {
  const r = await j("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email: "smoke-user@nexus.local", token: "definitely-not-valid", new_password: "brandnew123" }),
  });
  assert(r.status === 400, `expected 400, got ${r.status}`);
});

await check("auth: google rejects missing and bogus tokens", async () => {
  const missing = await j("/auth/google", { method: "POST", body: JSON.stringify({}) });
  assert(missing.status === 400, `missing id_token: expected 400, got ${missing.status}`);
  const bogus = await j("/auth/google", { method: "POST", body: JSON.stringify({ id_token: "bogus.jwt.value" }) });
  assert(bogus.status === 401, `bogus id_token: expected 401, got ${bogus.status}`);
});

await check("analytics: record an event", async () => {
  const r = await j("/analytics", { method: "POST", body: JSON.stringify({ type: "track", event: "smoke_event" }) });
  assert(r.status === 200 && r.data?.ok, "analytics event not recorded");
});

await check("agents: create conversation + add message", async () => {
  const c = await j("/agents/conversations", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ agent_name: "ab_test_optimizer" }) });
  assert(c.status === 200 && c.data?.id, "conversation not created");
  const list = await j(`/agents/conversations/${c.data.id}/messages`, { method: "GET", headers: { authorization: `Bearer ${token}` } });
  assert(Array.isArray(list.data), "messages list not an array");
});

await check("entities: filter seeded SurveyABTest", async () => {
  const r = await j("/entities/SurveyABTest/filter", { method: "POST", body: JSON.stringify({ query: { status: "active" } }) });
  assert(Array.isArray(r.data), "filter did not return an array");
  assert(r.data.some((x: Record<string, unknown>) => x.id === "abtest-seed-1"), "seeded test not found");
});

await check("entities: create + read-back roundtrip", async () => {
  const created = await j("/entities/UserActivity/create", {
    method: "POST", headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: { action: "smoke_test", value: 42 } }),
  });
  assert(created.status === 200 && created.data?.id, "create failed");
  const back = await j("/entities/UserActivity/get", { method: "POST", body: JSON.stringify({ id: created.data.id }) });
  assert(back.data?.value === 42, "roundtrip value mismatch");
});

await check("functions: invoke abTestAssigner (assign)", async () => {
  const r = await j("/functions/abTestAssigner", {
    method: "POST", headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: "assign", test_id: "abtest-seed-1", user_id: "smoke-user" }),
  });
  assert(r.status === 200, `status ${r.status}`);
  assert(r.data?.variant === "a" || r.data?.variant === "b", "no variant returned");
});

// Optional: only runs if an LLM key is configured on the backend.
await check("integrations: InvokeLLM (optional)", async () => {
  const r = await j("/integrations/InvokeLLM", { method: "POST", body: JSON.stringify({ prompt: "Reply with the single word: ok" }) });
  if (r.status === 500 && String(r.data?.error ?? "").match(/key|OPENAI|ANTHROPIC/i)) { results.push("    (skipped — no LLM key set)"); return; }
  assert(r.status === 200, `status ${r.status}`);
});

console.log(`\nNexus backend smoke test — ${BASE}\n`);
console.log(results.join("\n"));
console.log(`\n${pass} passed, ${fail} failed\n`);
Deno.exit(fail ? 1 : 0);
