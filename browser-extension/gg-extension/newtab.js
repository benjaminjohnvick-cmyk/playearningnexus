// newtab.js — the new-tab earn surface. Shows the user's status, renders OUR OWN advertiser inventory (served
// by the backend from extension-eligible campaigns), and credits Site Points after a completed, USER-INITIATED
// view. No auto-play: the user taps "Watch to earn," the ad shows for a minimum view time, then we reward.
import { getApiBase, getConfig, serveAd, rewardAdView, isSignedIn } from "./api.js";

const $ = (id) => document.getElementById(id);
const money = (usd) => `$${(Number(usd) || 0).toFixed(2)}`;
const MIN_VIEW_MS = 5000; // minimum on-screen time before a view counts (a real, viewable impression)

let currentAd = null;

async function render() {
  if (!(await isSignedIn())) { showSignedOut(); return; }
  let cfg;
  try { cfg = await getConfig(); } catch { showSignedOut(); return; }
  if (!cfg?.enabled) { showSignedOut(); return; }

  $("signedout").hidden = true;
  $("earn").hidden = false;
  // Config exposes today's earnings + the daily cap (there is no running balance field). Show progress to cap.
  {
    const today = Number(cfg.rewards?.earned_today_usd || 0);
    const cap = Number(cfg.rewards?.daily_cap_usd || 0);
    $("balance").textContent = cap > 0 ? `${money(today)} / ${money(cap)} today` : (today > 0 ? `${money(today)} today` : "Site Cash");
  }
  $("streak").textContent = cfg.prefs?.rewards_opt_out ? "Rewards are off — turn them on in Settings." : (cfg.rewards?.per_ad_points ? `Earn ${cfg.rewards.per_ad_points}¢ per ad · ${money(cfg.rewards.earned_today_usd)} today` : "");

  const canEarn = cfg.rewards?.enrolled && cfg.layers?.own_ads && cfg.rewards?.ad_available;
  $("watchBtn").disabled = !canEarn;
  $("capnote").textContent = cfg.layers?.own_ads ? (cfg.rewards?.ad_available ? "" : "Daily limit reached — back tomorrow.") : "Earning isn't live yet.";
  $("adInner").textContent = "Your reward ad will appear here.";
}

async function showSignedOut() {
  $("signedout").hidden = false; $("earn").hidden = true; $("signinLink").href = await getApiBase();
}

async function watchAndEarn() {
  const btn = $("watchBtn");
  btn.disabled = true; $("note").textContent = "Loading your ad…";
  try {
    // 1) Ask the backend for one of OUR OWN creatives (or a house cross-sell if no paid inventory).
    const res = await serveAd();
    currentAd = res?.ad || null;
    renderAd(currentAd);

    // 2) Require a real minimum view before crediting (user-initiated, viewable).
    $("note").textContent = "Thanks for watching…";
    await new Promise((r) => setTimeout(r, MIN_VIEW_MS));

    // 3) A house cross-sell isn't a paid impression — don't credit; just let them click it.
    if (currentAd?.house) { $("note").textContent = "Tap the offer above to explore."; btn.disabled = false; return; }

    // 4) Credit the reward (server enforces the daily/lifetime caps).
    const r = await rewardAdView({ ad_unit: "newtab_slot", advertiser_id: currentAd?.advertiser_id || "" });
    $("note").textContent = r.capped ? (r.note || "Daily limit reached.") : `You earned ${money(r.credited_usd)}! 🎉`;
  } catch (e) {
    $("note").textContent = e.message || "Couldn't complete — try again.";
  }
  await render();
}

// Render the served creative into our own slot. Image creative if provided, else a text card. Clicking opens
// the advertiser's landing page in a new tab. We never inject anything into third-party pages.
function renderAd(ad) {
  const inner = $("adInner");
  inner.innerHTML = "";
  if (!ad) { inner.textContent = "No ad available right now."; return; }
  const wrap = document.createElement("a");
  wrap.href = ad.url && ad.url !== "#" ? ad.url : "#";
  if (wrap.href !== "#") { wrap.target = "_blank"; wrap.rel = "noopener"; }
  wrap.style.cssText = "display:block;text-decoration:none;color:inherit;width:100%";
  if (ad.image_url) {
    const img = document.createElement("img");
    img.src = ad.image_url; img.alt = ad.title || "Sponsored"; img.style.cssText = "max-width:100%;border-radius:8px";
    wrap.appendChild(img);
  }
  const cap = document.createElement("div");
  cap.style.cssText = "margin-top:8px;font-size:13px";
  cap.textContent = (ad.house ? "" : "Sponsored · ") + (ad.title || "Sponsored");
  wrap.appendChild(cap);
  inner.appendChild(wrap);
}

$("watchBtn").addEventListener("click", watchAndEarn);
render();
