// content-auth.js — the AUTH BRIDGE. Runs ONLY on our own app origins (see manifest content_scripts). When the
// user is signed in on the site, the app stores a session JWT in localStorage under 'nexus_token'. This script
// reads that token and hands it to the extension (chrome.storage.local.authToken) so the extension can call the
// backend AS THE USER (the backend authenticates via `Authorization: Bearer <token>`). It reads nothing else,
// runs on no other site, and clears the stored token the moment the user signs out.
(function () {
  const TOKEN_KEY = "nexus_token";
  let last = null;

  function currentToken() {
    try { return localStorage.getItem(TOKEN_KEY) || null; } catch { return null; }
  }

  function sync(force) {
    const tok = currentToken();
    if (!force && tok === last) return;
    last = tok;
    try {
      if (tok) chrome.storage?.local?.set({ authToken: tok });
      else chrome.storage?.local?.remove("authToken"); // signed out → clear it
    } catch { /* extension context gone; ignore */ }
  }

  // Initial sync + keep in step: storage events (other tabs), focus, and a slow poll (same-tab writes don't
  // fire 'storage'). Cheap — just a string compare unless it actually changed.
  sync(true);
  window.addEventListener("storage", (e) => { if (e.key === TOKEN_KEY || e.key === null) sync(false); });
  window.addEventListener("focus", () => sync(false));
  setInterval(() => sync(false), 15000);
})();
