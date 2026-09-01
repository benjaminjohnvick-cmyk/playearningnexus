import { __handler } from "../../sdk/runtime.ts";
import { snapBool, snapString } from "../../sdk/settings.ts";

// mobileOtaConfig (PUBLIC, no auth) — the runtime control installed mobile apps read BEFORE applying any
// over-the-air web-bundle update. Returns whether OTA is currently allowed and which channel to pull from.
// This is the app-store-policy safety valve: flip MOBILE_OTA_ENABLED off and installed apps stop applying OTA
// bundles at once (halting an out-of-scope or bad rollout). No secrets are returned; it's safe to call
// unauthenticated so the app can check it on boot/resume before a user signs in.
//   → { ota_enabled: boolean, channel: string }
export default __handler(async (_req) => {
  try {
    return Response.json({
      ota_enabled: snapBool("MOBILE_OTA_ENABLED", false),
      channel: snapString("MOBILE_OTA_CHANNEL", "production"),
    });
  } catch {
    // Fail closed: if we can't read the setting, tell the app NOT to apply an update (safer for compliance).
    return Response.json({ ota_enabled: false, channel: "production" });
  }
});
