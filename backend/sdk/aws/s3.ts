// S3 uploads via presigned PUT. UploadFile returns { upload_url, file_url }: the client
// PUTs the file bytes to upload_url, then references file_url. (Base44 UploadFile took
// bytes directly; the presigned pattern keeps large files off the backend.)
import { presignS3Put, credsFromEnv } from "./sigv4.ts";

export async function uploadFileUrls(filename: string): Promise<{ upload_url: string; file_url: string; key: string }> {
  const bucket = Deno.env.get("S3_BUCKET")!;
  const region = Deno.env.get("AWS_REGION") ?? "us-east-1";
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, "_");
  const key = `uploads/${Date.now()}-${safe}`;
  const upload_url = await presignS3Put(credsFromEnv(), bucket, key, Number(Deno.env.get("S3_PRESIGN_EXPIRES") ?? "900"));
  const publicBase = Deno.env.get("S3_PUBLIC_BASE") ?? `https://${bucket}.s3.${region}.amazonaws.com`;
  return { upload_url, file_url: `${publicBase}/${key}`, key };
}

/** Server-side upload of raw bytes (e.g. an AI-generated catalog image) to S3 via presigned PUT.
 *  Returns the durable public file_url, or null if S3 isn't configured / the PUT failed. */
export async function uploadBytes(filename: string, bytes: Uint8Array, contentType = "application/octet-stream", prefix = "catalog"): Promise<string | null> {
  const bucket = Deno.env.get("S3_BUCKET");
  if (!bucket) return null;
  const region = Deno.env.get("AWS_REGION") ?? "us-east-1";
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, "_");
  const key = `${prefix}/${Date.now()}-${safe}`;
  try {
    const upload_url = await presignS3Put(credsFromEnv(), bucket, key, Number(Deno.env.get("S3_PRESIGN_EXPIRES") ?? "900"));
    const put = await fetch(upload_url, { method: "PUT", headers: { "content-type": contentType }, body: bytes });
    if (!put.ok) return null;
    const publicBase = Deno.env.get("S3_PUBLIC_BASE") ?? `https://${bucket}.s3.${region}.amazonaws.com`;
    return `${publicBase}/${key}`;
  } catch { return null; }
}
