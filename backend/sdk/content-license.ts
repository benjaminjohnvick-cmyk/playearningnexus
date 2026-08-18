// content-license.ts — the rights attestation + license grant captured when a user uploads content (ad
// creatives, product images, storefront media). Part of the DMCA posture: we take a license only to what the
// uploader certifies they have the right to give, and we log that certification so a takedown/counter-notice has
// a record to point at. Tracks state only.
import { snapString } from "./settings.ts";
import { recordConsent } from "./consent-ledger.ts";

/** Bump this (via CONTENT_LICENSE_VERSION) to force re-attestation after the license text changes. */
export const contentLicenseVersion = () => snapString("CONTENT_LICENSE_VERSION", "1");

/** The plain-language rights attestation an uploader agrees to. Kept short and specific. */
export function contentLicenseText(): string {
  return (
    "I own or have the necessary rights and licenses to the content I'm uploading (images, text, product " +
    "info), and I grant the platform a non-exclusive, worldwide, royalty-free license to host, display, and " +
    "distribute it for advertising on the platform. It does not infringe anyone's copyright, trademark, or " +
    "other rights, and it complies with the platform's content rules. I understand infringing content is " +
    "removed under the DMCA and I may be asked to submit a counter-notice."
  );
}

/** Record a content-license grant to the consent ledger. `contentType` e.g. "ad_creative", "storefront_media";
 *  `contentRef` is the record/id/URL the license covers. Best-effort; never throws into the caller. */
export async function recordContentLicense(opts: {
  userId: string; contentType: string; contentRef?: string | null; ip?: string | null;
}): Promise<void> {
  await recordConsent({
    user_id: opts.userId,
    kind: "content_license",
    version: contentLicenseVersion(),
    accepted: true,
    ip: opts.ip ?? null,
    meta: { content_type: opts.contentType, content_ref: opts.contentRef ?? null, license_text: contentLicenseText() },
  }).catch(() => {});
}
