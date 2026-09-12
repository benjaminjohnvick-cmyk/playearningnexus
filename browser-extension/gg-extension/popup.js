// popup.js — quick status + the rewards opt-out toggle (rewards are default-ON/opt-out per the design).
import { getConfig, enroll } from "./api.js";

const $ = (id) => document.getElementById(id);

async function load() {
  try {
    const cfg = await getConfig();
    if (!cfg?.enabled) { $("status").textContent = "unavailable"; return; }
    $("status").textContent = cfg.prefs?.rewards_opt_out ? "rewards off" : "earning";
    $("rewardsToggle").checked = !cfg.prefs?.rewards_opt_out; // checked = earning (not opted out)
  } catch (_e) {
    $("status").textContent = "sign in";
  }
}

$("rewardsToggle").addEventListener("change", async (e) => {
  try { await enroll({ rewards_opt_out: !e.target.checked }); await load(); } catch (_err) {}
});

$("openEarn").addEventListener("click", () => chrome.tabs.create({ url: "newtab.html" }));

load();
