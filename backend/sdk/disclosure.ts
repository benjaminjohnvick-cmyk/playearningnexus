// FTC endorsement / advertising disclosure helper (Master Plan #11).
//
// The FTC requires a clear, conspicuous sponsorship disclosure on paid/affiliate social posts.
// withAdDisclosure() appends "#ad · Sponsored" unless the content already carries a disclosure.

import { snapString } from "./settings.ts";
export const AD_DISCLOSURE = Deno.env.get("AD_DISCLOSURE_TAG") ?? "#ad";

const ALREADY_DISCLOSED = /#ad\b|#sponsored\b|\bpaid partnership\b|\bsponsored\b/i;

export function withAdDisclosure(content: string): string {
  const c = String(content ?? "");
  if (ALREADY_DISCLOSED.test(c)) return c;
  return `${c}\n\n${snapString("AD_DISCLOSURE_TAG", AD_DISCLOSURE)} · Sponsored`;
}

// FTC "clear and conspicuous" is strongest when the disclosure LEADS the post rather than trailing it.
// withAdDisclosureFront() puts "#ad · Sponsored" at the very top so a reader (and the member reviewing
// the draft) sees it before the ad copy. Used by the member-in-the-loop social scheduler.
export function withAdDisclosureFront(content: string): string {
  const c = String(content ?? "");
  if (ALREADY_DISCLOSED.test(c)) return c;
  return `${snapString("AD_DISCLOSURE_TAG", AD_DISCLOSURE)} · Sponsored\n\n${c}`;
}
