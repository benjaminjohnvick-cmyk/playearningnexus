// adgrid.ts — the PPC AdGrid survey engine (premium tier). A grid of product thumbnails; each carries 2
// advertiser survey questions plus a permanent "Option E: are you interested?". A user works a daily session
// of ADGRID_THUMBNAILS_PER_SESSION (16) thumbnails × 2 questions = ADGRID_THUMBNAIL_PRICE (0.50) each →
// $8 gross/day, split 50/50 (see survey-reward.ts). "Not interested" suppresses that product for the user;
// every product they engage is auto-added to their wishlist; their answers are appended to a per-user
// profile (.txt) the AI can use for matching.

import { snapNumber } from "./settings.ts";

export const adgridThumbnailPrice = () => Math.max(0, snapNumber("ADGRID_THUMBNAIL_PRICE", 0.50));
export const adgridThumbnailsPerSession = () => Math.max(1, Math.round(snapNumber("ADGRID_THUMBNAILS_PER_SESSION", 16)));
export const adgridQuestionsPerThumbnail = () => Math.max(1, Math.round(snapNumber("ADGRID_QUESTIONS_PER_THUMBNAIL", 2)));

/** The permanent interest question appended to every thumbnail (Option E). */
export const INTEREST_QUESTION = "Are you interested in this product?";

/** Daily session gross target = thumbnails × price (defaults to $8). */
export function sessionGrossTarget(): number {
  return Math.round(adgridThumbnailsPerSession() * adgridThumbnailPrice() * 100) / 100;
}

/** Render one answer set as a line for the user's plaintext profile. */
export function profileLine(day: string, adTitle: string, answers: { q: string; choice: string }[], interested: boolean): string {
  const qa = (answers || []).map((a) => `${a.q} => ${a.choice}`).join(" | ");
  return `[${day}] ${adTitle} :: ${qa} | interested=${interested ? "yes" : "no"}`;
}
