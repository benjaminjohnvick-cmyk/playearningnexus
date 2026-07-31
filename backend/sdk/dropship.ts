// dropship.ts — the FULL-AUTOMATION channel. Places real orders through an AUTHORIZED supplier API (your
// account), so the AI can fulfill end-to-end with no human and no bot. Credentials live in the environment;
// per-supplier endpoints come from the Supplier record. Nothing places an order until a supplier is
// connected — otherwise the flow falls back to affiliate hand-off or the buying desk.
//
// Suppliers differ, so this is a NORMALIZED adapter: it POSTs a standard order payload to the supplier's
// configured order endpoint with a bearer key. Swap in a supplier-specific mapping where a partner needs it.

import type { SourcedItem } from "./sourcing.ts";

/** A connected supplier's runtime config (from the Supplier entity, secret via env). */
export interface SupplierConfig {
  id: string;
  name: string;
  api_base: string;          // e.g. https://api.supplier.com
  api_key_env: string;       // name of the env var holding this supplier's key
  order_path?: string;       // default "/orders"
  active?: boolean;
}

export function supplierKey(cfg: SupplierConfig): string {
  return cfg?.api_key_env ? (Deno.env.get(cfg.api_key_env) || "") : "";
}
export function supplierReady(cfg: SupplierConfig | null | undefined): boolean {
  return !!cfg && !!cfg.api_base && !!supplierKey(cfg) && cfg.active !== false;
}

export interface DropshipResult { placed: boolean; supplier_order_id: string | null; tracking: string | null; status: string; reason?: string }

/** Place an order with a connected supplier via their API. Returns placed:false (with a reason) when the
 *  supplier isn't configured, so the caller can fall back to affiliate/buying-desk. */
export async function placeDropshipOrder(cfg: SupplierConfig, input: {
  item: SourcedItem; quantity?: number; shipping: Record<string, unknown>; ref?: string;
}): Promise<DropshipResult> {
  if (!supplierReady(cfg)) return { placed: false, supplier_order_id: null, tracking: null, status: "not_configured", reason: "Supplier API not connected." };
  try {
    const url = `${cfg.api_base.replace(/\/+$/, "")}${cfg.order_path || "/orders"}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${supplierKey(cfg)}`, "content-type": "application/json" },
      body: JSON.stringify({
        external_ref: input.ref || null,
        sku: input.item.sku || null,
        title: input.item.title,
        quantity: Math.max(1, Math.round(input.quantity || 1)),
        ship_to: input.shipping,
      }),
    });
    if (!res.ok) return { placed: false, supplier_order_id: null, tracking: null, status: `http_${res.status}`, reason: `Supplier rejected the order (${res.status}).` };
    const j = await res.json().catch(() => ({}));
    return {
      placed: true,
      supplier_order_id: j.id ? String(j.id) : (j.order_id ? String(j.order_id) : null),
      tracking: j.tracking ? String(j.tracking) : (j.tracking_number ? String(j.tracking_number) : null),
      status: String(j.status || "placed"),
    };
  } catch (e) {
    return { placed: false, supplier_order_id: null, tracking: null, status: "error", reason: (e as Error).message };
  }
}
