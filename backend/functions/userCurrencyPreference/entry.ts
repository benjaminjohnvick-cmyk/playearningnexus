import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { CURRENCIES, isSupportedCurrency } from "../../sdk/currency.ts";
import { userCurrency } from "../../sdk/localize-price.ts";

// userCurrencyPreference — the user-settings currency picker. A user can OVERRIDE their auto-detected currency,
// or clear the override to go back to auto-detect. Purely a DISPLAY preference (which currency prices are shown
// in); orders are still charged in Site Cash. The user only ever changes their OWN preference.
//
//   action "get" (default) — current override, the auto-detected currency, the resolved currency, and the list
//                            of currencies for the picker.
//   action "set"  { currency } — set the override ("AUTO" or "" clears it back to auto-detect).
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "get");

    const u = user as Record<string, unknown>;
    const autoDetected = userCurrency({ ...u, currency: undefined }, "USD");

    if (action === "get") {
      return Response.json({
        ok: true,
        override: u.currency ? String(u.currency).toUpperCase() : null,
        auto_detected: autoDetected,
        resolved: userCurrency(u, "USD"),
        currencies: CURRENCIES,
        note: "Pick a currency to override the one we detected, or choose Auto to detect it from your locale. Display only — orders are charged in Site Cash.",
      });
    }

    if (action === "set") {
      const raw = String(body?.currency || "").toUpperCase().trim();
      // Clear the override → auto-detect.
      if (!raw || raw === "AUTO") {
        await db.update("User", String(user.id), { currency: null }).catch(() => null);
        return Response.json({ ok: true, override: null, resolved: autoDetected, note: `Currency set to Auto — using ${autoDetected}.` });
      }
      if (!isSupportedCurrency(raw)) {
        return Response.json({ ok: false, error: `"${raw}" isn't a supported currency.`, currencies: CURRENCIES }, { status: 422 });
      }
      await db.update("User", String(user.id), { currency: raw }).catch(() => null);
      return Response.json({ ok: true, override: raw, resolved: raw, note: `Prices will now display in ${raw}. (Orders are charged in Site Cash.)` });
    }

    return Response.json({ error: `unknown action "${action}"` }, { status: 400 });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
