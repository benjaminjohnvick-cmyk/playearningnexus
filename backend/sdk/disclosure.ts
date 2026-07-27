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
