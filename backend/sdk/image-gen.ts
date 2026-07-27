// Catalog image generation — original product images at effectively-unlimited scale, cheaply.
//
// This is the "cheap, no per-image-lock-in" pipeline the marketplace catalog uses. It leans on a
// SERVERLESS GPU on AWS (set IMAGE_PROVIDER=aws_bedrock for zero infra, or aws_sagemaker to host your
// own SDXL/FLUX endpoint that scales to zero) so you pay only for the seconds spent generating and
// never per-image API list prices. Every image is ORIGINAL — generated from an original product
// concept — so there is no copyright exposure from copying a retailer's photos.
//
// Design guarantees:
//   • Env-gated: if no image provider is configured, generation is skipped and listings launch
//     text-only. Nothing crashes, nothing is charged.
//   • Budget-capped: honors CATALOG_IMAGES_ENABLED and a per-run cap so a seed run can't run away.
//   • Durable: if S3 is configured the base64 image is persisted and the listing stores a short URL;
//     otherwise the data URL is returned inline.

import { Core } from "./integrations.ts";
import { snapString, snapNumber, snapBool } from "./settings.ts";
import { uploadBytes } from "./aws/s3.ts";

/** True when an image provider is actually wired (so callers can decide to attempt images at all). */
export function imageGenConfigured(): boolean {
  // Sync snapshot read (kill switch). Boolean settings store as "1"/"0", so use snapBool — a plain
  // string compare against "false" would fail open when an admin toggles it off in the panel.
  if (!snapBool("CATALOG_IMAGES_ENABLED", true)) return false;
  const provider = snapString("IMAGE_PROVIDER", "openai");
  switch (provider) {
    case "aws_bedrock":   return !!Deno.env.get("AWS_ACCESS_KEY_ID") && !!Deno.env.get("AWS_SECRET_ACCESS_KEY");
    case "aws_sagemaker": return !!Deno.env.get("AWS_ACCESS_KEY_ID") && !!Deno.env.get("SAGEMAKER_IMAGE_ENDPOINT");
    case "stability":     return !!(Deno.env.get("IMAGE_API_KEY") ?? Deno.env.get("STABILITY_API_KEY"));
    default:              return !!(Deno.env.get("IMAGE_API_KEY") ?? Deno.env.get("OPENAI_API_KEY"));
  }
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; contentType: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return null;
  try {
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, contentType: m[1] };
  } catch { return null; }
}

/** Generate ONE original product image and return a durable URL (S3) or an inline data URL.
 *  Returns null when images are disabled/unconfigured or generation failed — caller goes text-only. */
export async function generateProductImageUrl(title: string, description = "", category = ""): Promise<string | null> {
  if (!imageGenConfigured()) return null;
  const style = snapString(
    "CATALOG_IMAGE_STYLE",
    "clean studio product photograph on a plain white background, centered, soft even lighting, e-commerce style, high detail, no text, no logos, no watermark",
  );
  const prompt = `Original product photo of: ${title}. ${description ? description.slice(0, 300) + ". " : ""}${category ? "Category: " + category + ". " : ""}${style}`.slice(0, 900);
  const size = snapString("CATALOG_IMAGE_SIZE", "1024x1024");
  try {
    const out = await Core.GenerateImage({ prompt, size }) as { url?: string };
    const url = out?.url ?? "";
    if (!url) return null;
    if (url.startsWith("data:")) {
      const parsed = dataUrlToBytes(url);
      if (parsed) {
        const ext = parsed.contentType.includes("jpeg") ? "jpg" : "png";
        const stored = await uploadBytes(`${slug(title)}.${ext}`, parsed.bytes, parsed.contentType, "catalog");
        return stored ?? url; // S3 URL if configured, else keep the inline data URL
      }
    }
    return url; // remote provider URL (OpenAI etc.)
  } catch { return null; }
}

/** Generate images for a batch of items, capped so a single seed run can't blow a budget.
 *  Mutates nothing; returns an array of (url | null) aligned to the input order. */
export async function generateProductImages(items: { title: string; description?: string; category?: string }[]): Promise<(string | null)[]> {
  if (!imageGenConfigured()) return items.map(() => null);
  const cap = Math.max(0, Math.floor(snapNumber("CATALOG_IMAGES_MAX_PER_RUN", 200)));
  const out: (string | null)[] = [];
  for (let i = 0; i < items.length; i++) {
    if (i >= cap) { out.push(null); continue; }
    out.push(await generateProductImageUrl(items[i].title, items[i].description ?? "", items[i].category ?? ""));
  }
  return out;
}

function slug(s: string): string {
  return (s || "product").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "product";
}
