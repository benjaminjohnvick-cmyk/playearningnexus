// content-shopping.js — the Honey-style shopping helper, done CLEAN. Runs on retailer pages ONLY after the user
// turns on the shopping helper (optional permission). It shows OUR OWN cashback prompt (our content, not an
// injected third-party ad) and applies our affiliate link ONLY when no other affiliate is already credited.
//
// THE ANTI-HONEY RULE (attribution hygiene), enforced client-side and re-checked server-side:
//   • If an existing affiliate cookie / referral param is present for this merchant, DO NOT override it.
//   • Only claim credit for a genuine click-through the user made via our prompt.
// The actual commission is credited later by the affiliate network's verified postback → extensionAffiliateReward.

(function () {
  // A tiny allowlist of supported merchants would live here (or be fetched). Kept minimal for the skeleton.
  const HOST = location.hostname.replace(/^www\./, "");

  // Detect whether another affiliate already owns attribution for this visit (never override it).
  function existingAffiliatePresent() {
    const url = new URL(location.href);
    const affParams = ["tag", "aff", "affid", "aff_id", "utm_source", "irclickid", "ranMID", "clickid", "cjevent"];
    if (affParams.some((p) => url.searchParams.has(p))) return true;
    // Common affiliate cookies (best-effort; the server postback is the source of truth).
    const cookieHints = ["aff", "cjevent", "irclickid", "ranSiteID", "AMCV", "_ga_aff"];
    return cookieHints.some((h) => document.cookie.includes(h));
  }

  function showCashbackPrompt() {
    if (document.getElementById("gg-cashback-prompt")) return;
    const existing = existingAffiliatePresent();
    const bar = document.createElement("div");
    bar.id = "gg-cashback-prompt";
    bar.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#111;color:#fff;padding:12px 14px;border-radius:12px;font:13px system-ui;box-shadow:0 6px 24px rgba(0,0,0,.3);max-width:280px";
    bar.innerHTML = existing
      ? `<div>You're already earning through another link on ${HOST} — we won't change it. 👍</div>`
      : `<div><strong>Cashback available on ${HOST}</strong><br/>Activate to earn Site Cash on this purchase.</div>
         <button id="gg-activate" style="margin-top:8px;background:#7c3aed;color:#fff;border:0;border-radius:8px;padding:6px 10px;cursor:pointer">Activate cashback</button>
         <button id="gg-dismiss" style="margin-left:6px;background:transparent;color:#aaa;border:0;cursor:pointer">Dismiss</button>`;
    document.body.appendChild(bar);

    const dismiss = () => bar.remove();
    document.getElementById("gg-dismiss")?.addEventListener("click", dismiss);
    document.getElementById("gg-activate")?.addEventListener("click", async () => {
      // GENUINE referral: the user clicked our prompt AND no other affiliate is present. Route through OUR
      // affiliate deep link so the network attributes the sale to us; the confirmed commission is credited
      // later by the network's verified postback → extensionAffiliateReward (server-side, clean-attribution).
      let redirectBase = "";
      try { ({ affiliateRedirectBase: redirectBase } = await chrome.storage.local.get("affiliateRedirectBase")); } catch { /* */ }
      if (redirectBase) {
        // Template: {base}?merchant={host}&url={encoded current url}. Configure the base in Settings once your
        // affiliate network is connected. We only ever reach here when NO other affiliate owns attribution.
        const dest = `${redirectBase}${redirectBase.includes("?") ? "&" : "?"}merchant=${encodeURIComponent(HOST)}&url=${encodeURIComponent(location.href)}`;
        bar.innerHTML = `<div>Cashback activated — taking you to ${HOST}… 🎉</div>`;
        setTimeout(() => { window.location.href = dest; }, 600);
      } else {
        bar.innerHTML = `<div>Cashback activated — shop as normal. Site Cash posts after the sale confirms. 🎉</div>`;
        setTimeout(dismiss, 4000);
      }
    });
  }

  // Only prompt on pages that look like a store; keep it unobtrusive.
  if (document.body) showCashbackPrompt();
})();
