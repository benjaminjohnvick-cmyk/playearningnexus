// options.js — settings: rewards opt-out, the shopping helper (optional host permission), and the OPTIONAL,
// off-by-default browsing/personalization layer (explicit opt-in + consent). Mirrors the design's Layer A / B.
import { getConfig, enroll } from "./api.js";

const $ = (id) => document.getElementById(id);
const msg = (t) => { $("msg").textContent = t; };

async function load() {
  // Advanced fields come from local storage and work even when signed out.
  try {
    const { apiBase, affiliateRedirectBase, shoppingOn } = await chrome.storage.local.get(["apiBase", "affiliateRedirectBase", "shoppingOn"]);
    $("apiBase").value = apiBase || "";
    $("affBase").value = affiliateRedirectBase || "";
    $("shoppingToggle").checked = !!shoppingOn;
  } catch (_e) { /* storage unavailable */ }
  try {
    const cfg = await getConfig();
    if (!cfg?.enabled) { msg("The extension isn't available right now."); return; }
    $("rewardsToggle").checked = !cfg.prefs?.rewards_opt_out;
    $("trackingToggle").checked = !!cfg.prefs?.tracking_opt_in;
  } catch (_e) { msg("Sign in on the site first, then reopen settings."); }
}

// Advanced: persist the backend URL + affiliate redirect base (local only; no account needed).
$("saveAdvanced").addEventListener("click", async () => {
  const apiBase = ($("apiBase").value || "").trim().replace(/\/$/, "");
  const affiliateRedirectBase = ($("affBase").value || "").trim();
  try {
    await chrome.storage.local.set({ ...(apiBase ? { apiBase } : {}), affiliateRedirectBase });
    if (!apiBase) await chrome.storage.local.remove("apiBase");
    msg("Advanced settings saved.");
  } catch (err) { msg(err.message); }
});

// Rewards (Layer A) — opt-out.
$("rewardsToggle").addEventListener("change", async (e) => {
  try { await enroll({ rewards_opt_out: !e.target.checked }); msg("Saved."); } catch (err) { msg(err.message); }
});

// Shopping helper — needs an OPTIONAL host permission; request it at opt-in, register the content script.
$("shoppingToggle").addEventListener("change", async (e) => {
  if (e.target.checked) {
    const granted = await chrome.permissions.request({ origins: ["https://*/*"] }).catch(() => false);
    if (!granted) { e.target.checked = false; msg("Permission needed to find cashback on retailer sites."); return; }
    await chrome.storage.local.set({ shoppingOn: true });
    chrome.runtime.sendMessage({ type: "SHOPPING_HELPER_ON" });
    msg("Shopping helper on.");
  } else {
    await chrome.storage.local.set({ shoppingOn: false });
    chrome.runtime.sendMessage({ type: "SHOPPING_HELPER_OFF" });
    msg("Shopping helper off.");
  }
});

// Personalization / browsing layer (Layer B) — OFF by default, explicit opt-in + consent, broad permission.
$("trackingToggle").addEventListener("change", async (e) => {
  if (e.target.checked) {
    const ok = confirm("Turn on personalized offers? The extension will use the sites you visit to tailor offers. You can turn this off anytime.");
    if (!ok) { e.target.checked = false; return; }
    const granted = await chrome.permissions.request({ origins: ["https://*/*"] }).catch(() => false);
    if (!granted) { e.target.checked = false; msg("Permission needed for personalized offers."); return; }
    try { await enroll({ tracking_opt_in: true }); msg("Personalized offers on."); } catch (err) { e.target.checked = false; msg(err.message); }
  } else {
    try { await enroll({ tracking_opt_in: false }); msg("Personalized offers off."); } catch (err) { msg(err.message); }
  }
});

load();
