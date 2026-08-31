// session-capabilities.ts — the pure gate for the optional hosting capabilities a host can turn on per session:
// recording/replay, remote-control (co-op), on-demand feed, and save-a-clip. Each is independently gated by the
// operator; a host can only request what the operator has enabled. Separately, remote control is the sharpest
// edge, so its SCOPE is locked down here: control can be handed to another player for GAME INPUT ONLY — never
// the OS, never navigation, never anything touching money or identity. Pure + unit-testable.

export type Capability = "record" | "remote_control" | "on_demand" | "clips";
export const ALL_CAPABILITIES: Capability[] = ["record", "remote_control", "on_demand", "clips"];

export interface CapabilityGates {
  record: boolean;
  remote_control: boolean;
  on_demand: boolean;
  clips: boolean;
}

export interface CapabilityResolution {
  enabled: Capability[];
  disabled: Array<{ cap: Capability; reason: string }>;
}

/** Intersect what the host REQUESTED with what the operator has ENABLED. A capability the operator gated off is
 *  never available, no matter what the host asks. Pure. */
export function resolveCapabilities(requested: string[] | undefined, gates: CapabilityGates): CapabilityResolution {
  const req = new Set((requested || []).map(String));
  const enabled: Capability[] = [];
  const disabled: Array<{ cap: Capability; reason: string }> = [];
  for (const cap of ALL_CAPABILITIES) {
    const wanted = req.has(cap);
    const gateOn = !!gates[cap];
    if (wanted && gateOn) enabled.push(cap);
    else if (wanted && !gateOn) disabled.push({ cap, reason: `disabled by operator (${gateKey(cap)} off)` });
  }
  return { enabled, disabled };
}

function gateKey(cap: Capability): string {
  return {
    record: "HOSTING_RECORDING_ENABLED",
    remote_control: "HOSTING_REMOTE_CONTROL_ENABLED",
    on_demand: "HOSTING_ONDEMAND_ENABLED",
    clips: "HOSTING_CLIPS_ENABLED",
  }[cap];
}

// ── Remote-control scope (hard security boundary) ───────────────────────────────────────────────────────────
// The ONLY scope a host may ever hand to another player. Anything else — OS control, app navigation, account, or
// payment — is forbidden here so a mis-typed or malicious request can't escalate a co-op control grant into
// control over sensitive parts of the app.
export const CONTROL_ALLOWED_SCOPES = ["game_input"] as const;
export type ControlScope = typeof CONTROL_ALLOWED_SCOPES[number];

const FORBIDDEN_SCOPE = /os|system|desktop|account|payment|payout|wallet|balance|nav|navigate|settings|admin|kyc|identity/i;

/** Decide whether a control grant of `scope` is allowed. Only "game_input" passes; everything else is refused.
 *  Pure. */
export function canGrantControl(scope: string): { ok: boolean; reason: string } {
  const s = String(scope || "").toLowerCase();
  if (FORBIDDEN_SCOPE.test(s)) return { ok: false, reason: `scope "${scope}" is forbidden — control is limited to in-game input, never OS/account/payment/navigation.` };
  if (!(CONTROL_ALLOWED_SCOPES as readonly string[]).includes(s)) return { ok: false, reason: `unknown scope "${scope}" — only ${CONTROL_ALLOWED_SCOPES.join(", ")} is allowed.` };
  return { ok: true, reason: "in-game input control" };
}
