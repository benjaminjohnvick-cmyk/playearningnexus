// S3-compatible uploads (AWS S3 OR Cloudflare R2 / MinIO). UploadFile returns { upload_url, file_url }: the
// client PUTs the bytes to upload_url, then references file_url. uploadBytes does a server-side PUT.
//
// ONE BUCKET FOR EVERYTHING: by default the general-upload store SHARES the broadcast/HLS bucket + creds, so if
// you've set up R2 for broadcast (HLS_STORAGE_BUCKET + HLS_S3_* / HLS_PLAYBACK_BASE_URL per the runbook), media
// uploads land in the same bucket automatically — no extra config. Override any piece with an S3_* var to point
// general uploads at a separate store instead.
//
// Resolution (first non-empty wins):
//   bucket   : S3_BUCKET            → HLS_STORAGE_BUCKET
//   endpoint : S3_ENDPOINT          → HLS_S3_ENDPOINT           (set ⇒ R2/MinIO mode: path-style + region "auto")
//   key id   : S3_ACCESS_KEY_ID     → HLS_S3_ACCESS_KEY_ID      → AWS_ACCESS_KEY_ID
//   secret   : S3_SECRET_ACCESS_KEY → HLS_S3_SECRET_ACCESS_KEY  → AWS_SECRET_ACCESS_KEY
//   region   : S3_REGION            → ("auto" when an endpoint is set, else AWS_REGION → us-east-1)
//   public   : S3_PUBLIC_BASE       → HLS_PLAYBACK_BASE_URL      → (AWS virtual-host URL when no endpoint)
//   pathStyle: S3_PATH_STYLE / HLS_S3_PATH_STYLE (default ON when an endpoint is set)
import { presignPut, presignS3Put, type AwsCreds } from "./sigv4.ts";

const env = (k: string) => (Deno.env.get(k) || "").trim();
const expiresSecs = () => Number(Deno.env.get("S3_PRESIGN_EXPIRES") ?? "900");

interface UploadStore {
  bucket: string; endpoint: string; pathStyle: boolean; region: string; creds: AwsCreds; publicBase: string;
}

/** Resolve the upload store, sharing the broadcast/HLS bucket by default (see header). */
export function uploadStore(): UploadStore {
  const bucket = env("S3_BUCKET") || env("HLS_STORAGE_BUCKET");
  const endpoint = env("S3_ENDPOINT") || env("HLS_S3_ENDPOINT");
  const region = env("S3_REGION") || (endpoint ? "auto" : (env("AWS_REGION") || "us-east-1"));
  const creds: AwsCreds = {
    accessKeyId: env("S3_ACCESS_KEY_ID") || env("HLS_S3_ACCESS_KEY_ID") || env("AWS_ACCESS_KEY_ID"),
    secretAccessKey: env("S3_SECRET_ACCESS_KEY") || env("HLS_S3_SECRET_ACCESS_KEY") || env("AWS_SECRET_ACCESS_KEY"),
    region,
    sessionToken: env("AWS_SESSION_TOKEN") || undefined,
  };
  const psRaw = env("S3_PATH_STYLE") || env("HLS_S3_PATH_STYLE");
  const pathStyle = psRaw ? psRaw === "1" : !!endpoint;
  const publicBase = (env("S3_PUBLIC_BASE") || env("HLS_PLAYBACK_BASE_URL") ||
    (endpoint ? "" : (bucket ? `https://${bucket}.s3.${region}.amazonaws.com` : ""))).replace(/\/+$/, "");
  return { bucket, endpoint, pathStyle, region, creds, publicBase };
}

/** True when the upload store has a bucket + write creds. */
export function uploadConfigured(): boolean {
  const s = uploadStore();
  return !!(s.bucket && s.creds.accessKeyId && s.creds.secretAccessKey);
}

/** Presign a PUT against the store (R2/MinIO endpoint when set, else AWS virtual-host — byte-identical to before). */
function presignFor(store: UploadStore, key: string, expires: number): Promise<string> {
  return store.endpoint
    ? presignPut(store.creds, store.bucket, key, { endpoint: store.endpoint, pathStyle: store.pathStyle, region: store.region, expires })
    : presignS3Put(store.creds, store.bucket, key, expires);
}

/** Public URL for a stored key: the CDN/public base when set, else the AWS virtual-host URL. */
function publicUrl(store: UploadStore, key: string): string {
  if (store.publicBase) return `${store.publicBase}/${key}`;
  return `https://${store.bucket}.s3.${store.region}.amazonaws.com/${key}`;
}

const safeName = (filename: string) => filename.replace(/[^A-Za-z0-9._-]/g, "_");

export async function uploadFileUrls(filename: string): Promise<{ upload_url: string; file_url: string; key: string }> {
  const store = uploadStore();
  if (!store.bucket) throw new Error("Upload store not configured — set S3_BUCKET or HLS_STORAGE_BUCKET.");
  const key = `uploads/${Date.now()}-${safeName(filename)}`;
  const upload_url = await presignFor(store, key, expiresSecs());
  return { upload_url, file_url: publicUrl(store, key), key };
}

/** Server-side upload of raw bytes (e.g. an AI-generated catalog image) via presigned PUT.
 *  Returns the durable public file_url, or null if the store isn't configured / the PUT failed. */
export async function uploadBytes(filename: string, bytes: Uint8Array, contentType = "application/octet-stream", prefix = "catalog"): Promise<string | null> {
  const store = uploadStore();
  if (!store.bucket || !store.creds.accessKeyId) return null;
  const key = `${prefix}/${Date.now()}-${safeName(filename)}`;
  try {
    const upload_url = await presignFor(store, key, expiresSecs());
    const put = await fetch(upload_url, { method: "PUT", headers: { "content-type": contentType }, body: bytes });
    if (!put.ok) return null;
    return publicUrl(store, key);
  } catch { return null; }
}
