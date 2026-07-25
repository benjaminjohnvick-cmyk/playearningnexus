// Single-service mode: serve the built React frontend (dist/) straight from the Deno backend,
// with SPA history fallback. This removes the separate frontend deploy AND all CORS wiring
// (frontend + API on one origin). Enabled by setting FRONTEND_DIR to the built assets folder
// (e.g. FRONTEND_DIR=./public after copying the Vite dist/ there). Empty = disabled (two-service mode).
const FRONTEND_DIR = (Deno.env.get("FRONTEND_DIR") ?? "").replace(/\/$/, "");

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8", js: "text/javascript", mjs: "text/javascript",
  css: "text/css", json: "application/json", png: "image/png", jpg: "image/jpeg",
  jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", ico: "image/x-icon",
  webp: "image/webp", woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf",
  txt: "text/plain", map: "application/json", webmanifest: "application/manifest+json",
  wasm: "application/wasm",
};

export function frontendEnabled(): boolean {
  return FRONTEND_DIR.length > 0;
}

// Returns a Response for a static asset, SPA-falling-back to index.html for unknown paths.
// Returns null only if FRONTEND_DIR is unset (so the caller keeps its normal 404 behavior).
export async function serveStatic(pathname: string): Promise<Response | null> {
  if (!FRONTEND_DIR) return null;
  // Block path traversal.
  const safe = pathname.replace(/\.\.+/g, "").replace(/\/{2,}/g, "/");
  let rel = safe === "/" ? "/index.html" : safe;

  const read = async (p: string) => await Deno.readFile(FRONTEND_DIR + p);
  try {
    let bytes: Uint8Array;
    try {
      bytes = await read(rel);
    } catch {
      // SPA fallback: any unmatched non-file path serves index.html so client-side routes work.
      rel = "/index.html";
      bytes = await read(rel);
    }
    const ext = (rel.split(".").pop() ?? "html").toLowerCase();
    const cache = ext === "html" ? "no-cache" : "public, max-age=31536000, immutable";
    return new Response(bytes, { headers: { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": cache } });
  } catch {
    return null;
  }
}
