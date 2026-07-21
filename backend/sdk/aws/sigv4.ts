// Minimal AWS Signature V4 for Deno (Web Crypto only — no aws-sdk dependency).
// Used by s3.ts (presigned PUT) and ses.ts (SendEmail). Enough surface for our needs.
const enc = new TextEncoder();

async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const buf = typeof data === "string" ? enc.encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return hex(new Uint8Array(hash));
}
function hex(b: Uint8Array): string { return [...b].map((x) => x.toString(16).padStart(2, "0")).join(""); }

async function hmac(key: Uint8Array, data: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}
async function signingKey(secret: string, date: string, region: string, service: string): Promise<Uint8Array> {
  const kDate = await hmac(enc.encode("AWS4" + secret), date);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return await hmac(kService, "aws4_request");
}
function amzDate(d = new Date()): { amz: string; date: string } {
  const amz = d.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amz, date: amz.slice(0, 8) };
}
const uriEncode = (s: string, encodeSlash = true) =>
  encodeURIComponent(s).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%2F/g, encodeSlash ? "%2F" : "/");

export interface AwsCreds { accessKeyId: string; secretAccessKey: string; region: string; sessionToken?: string; }

/** Presign an S3 PUT URL (query-string auth, UNSIGNED-PAYLOAD). */
export async function presignS3Put(creds: AwsCreds, bucket: string, key: string, expires = 900): Promise<string> {
  const host = `${bucket}.s3.${creds.region}.amazonaws.com`;
  const { amz, date } = amzDate();
  const scope = `${date}/${creds.region}/s3/aws4_request`;
  const q = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${creds.accessKeyId}/${scope}`,
    "X-Amz-Date": amz,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  });
  if (creds.sessionToken) q.set("X-Amz-Security-Token", creds.sessionToken);
  const canonicalUri = "/" + key.split("/").map((s) => uriEncode(s, false)).join("/");
  const canonicalQuery = [...q.entries()].map(([k, v]) => `${uriEncode(k)}=${uriEncode(v)}`).sort().join("&");
  const canonicalReq = ["PUT", canonicalUri, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const sts = ["AWS4-HMAC-SHA256", amz, scope, await sha256Hex(canonicalReq)].join("\n");
  const sig = hex(await hmac(await signingKey(creds.secretAccessKey, date, creds.region, "s3"), sts));
  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${sig}`;
}

/** Signed POST to an AWS JSON/REST service (used by SES v2). */
export async function signedFetch(creds: AwsCreds, service: string, host: string, pathname: string, bodyStr: string, contentType = "application/json"): Promise<Response> {
  const { amz, date } = amzDate();
  const scope = `${date}/${creds.region}/${service}/aws4_request`;
  const payloadHash = await sha256Hex(bodyStr);
  const headers: Record<string, string> = {
    "content-type": contentType, host, "x-amz-content-sha256": payloadHash, "x-amz-date": amz,
  };
  if (creds.sessionToken) headers["x-amz-security-token"] = creds.sessionToken;
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers).sort().map((k) => `${k}:${headers[k]}\n`).join("");
  const canonicalReq = ["POST", pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const sts = ["AWS4-HMAC-SHA256", amz, scope, await sha256Hex(canonicalReq)].join("\n");
  const sig = hex(await hmac(await signingKey(creds.secretAccessKey, date, creds.region, service), sts));
  headers["authorization"] = `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`;
  return await fetch(`https://${host}${pathname}`, { method: "POST", headers, body: bodyStr });
}

export function credsFromEnv(): AwsCreds {
  return {
    accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID") ?? "",
    secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY") ?? "",
    region: Deno.env.get("AWS_REGION") ?? "us-east-1",
    sessionToken: Deno.env.get("AWS_SESSION_TOKEN") ?? undefined,
  };
}
