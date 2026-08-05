#!/usr/bin/env node
// Inject the native permission strings the contact-invite feature needs, into the GENERATED native shells.
//
// The repo is wrapper-only (android/ and ios/ are git-ignored and recreated by `npx cap add`), so these keys
// must be re-applied every time the shells are regenerated. Run this AFTER `npx cap add` / `npx cap sync`,
// BEFORE building. It is idempotent (safe to run repeatedly) and a no-op when a platform folder is absent.
//
//   iOS     → ios/App/App/Info.plist            : NSContactsUsageDescription
//   Android → android/app/src/main/AndroidManifest.xml : android.permission.READ_CONTACTS
//
// Referenced by scripts/regenerate-native.sh and codemagic.yaml.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CONTACTS_USAGE =
  "We use your contacts only on this device so you can pick friends to invite. Your contacts are never uploaded or stored on our servers — invites are sent from your own Messages app.";

function log(m) { console.log(`[inject-native-permissions] ${m}`); }

// ---- iOS: Info.plist ----------------------------------------------------------------------------
function patchInfoPlist() {
  const p = "ios/App/App/Info.plist";
  if (!existsSync(p)) { log("iOS Info.plist not present — skipping (run after `cap add ios`)."); return; }
  let s = readFileSync(p, "utf8");
  if (s.includes("NSContactsUsageDescription")) { log("iOS: NSContactsUsageDescription already present."); return; }
  const entry = `\t<key>NSContactsUsageDescription</key>\n\t<string>${CONTACTS_USAGE}</string>\n`;
  // Insert before the OUTERMOST </dict> (the last </dict> in the file, which closes the top-level dict).
  const idx = s.lastIndexOf("</dict>");
  if (idx === -1) { log("iOS: could not find </dict> — Info.plist looks unexpected; NOT modified."); return; }
  s = s.slice(0, idx) + entry + s.slice(idx);
  writeFileSync(p, s);
  log("iOS: added NSContactsUsageDescription to Info.plist.");
}

// ---- Android: AndroidManifest.xml ---------------------------------------------------------------
function patchAndroidManifest() {
  const p = "android/app/src/main/AndroidManifest.xml";
  if (!existsSync(p)) { log("Android manifest not present — skipping (run after `cap add android`)."); return; }
  let s = readFileSync(p, "utf8");
  if (s.includes('android.permission.READ_CONTACTS')) { log("Android: READ_CONTACTS already present."); return; }
  const perm = `\n    <uses-permission android:name="android.permission.READ_CONTACTS" />`;
  // Insert right after the opening <manifest ...> tag.
  const m = s.match(/<manifest\b[^>]*>/);
  if (!m) { log("Android: could not find <manifest> tag; NOT modified."); return; }
  const at = m.index + m[0].length;
  s = s.slice(0, at) + perm + s.slice(at);
  writeFileSync(p, s);
  log("Android: added READ_CONTACTS to AndroidManifest.xml.");
}

patchInfoPlist();
patchAndroidManifest();
log("done.");
