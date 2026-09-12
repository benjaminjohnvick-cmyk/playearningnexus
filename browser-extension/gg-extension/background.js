// background.js — MV3 service worker. Handles first-install enrollment, marks the install once the user signs
// in (when the auth bridge first supplies a token), and dynamically registers the opt-in shopping helper
// content script (only after the user opts in, via optional host permissions). No tracking here.
import { enroll } from "./api.js";

// On install: open the welcome/settings page and TRY to mark installed (no-op if not signed in yet — the
// storage listener below marks it the moment the user signs in on the site).
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    try { await enroll({ installed: true }); } catch (_e) { /* not signed in yet */ }
    chrome.tabs.create({ url: "options.html?welcome=1" });
  }
});

// Mark the install exactly once, the first time the auth bridge supplies a session token (i.e. the user signed
// in on the site). Guarded by a flag so we don't re-enroll on every token refresh.
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local" || !changes.authToken) return;
  const nowToken = changes.authToken.newValue;
  if (!nowToken) return;
  try {
    const { installMarked } = await chrome.storage.local.get("installMarked");
    if (installMarked) return;
    await enroll({ installed: true });
    await chrome.storage.local.set({ installMarked: true });
  } catch (_e) { /* backend unavailable / gated off — retry on next sign-in */ }
});

// The shopping helper is registered ONLY when the user turns it on (options.js requests the optional host
// permission, then messages here). It is NOT active at install. registerContentScripts persists across sessions.
const SHOPPING_SCRIPT_ID = "gg-shopping-helper";

async function registerShoppingHelper() {
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SHOPPING_SCRIPT_ID] }).catch(() => []);
    if (existing && existing.length) return;
    await chrome.scripting.registerContentScripts([{
      id: SHOPPING_SCRIPT_ID,
      js: ["content-shopping.js"],
      matches: ["https://*/*"],       // gated behind the optional permission the user granted
      runAt: "document_idle",
      persistAcrossSessions: true,
    }]);
  } catch (_e) { /* permission not granted — no-op */ }
}

async function unregisterShoppingHelper() {
  try { await chrome.scripting.unregisterContentScripts({ ids: [SHOPPING_SCRIPT_ID] }); } catch (_e) { /* not registered */ }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "SHOPPING_HELPER_ON") { registerShoppingHelper().then(() => sendResponse({ ok: true })); return true; }
  if (msg?.type === "SHOPPING_HELPER_OFF") { unregisterShoppingHelper().then(() => sendResponse({ ok: true })); return true; }
  return false;
});
