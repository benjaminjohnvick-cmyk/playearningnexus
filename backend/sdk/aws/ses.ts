// SES v2 SendEmail via signed POST. Enable with EMAIL_PROVIDER=ses.
import { signedFetch, credsFromEnv } from "./sigv4.ts";

export async function sesSend(args: { to: string; subject: string; body: string; from?: string }) {
  const creds = credsFromEnv();
  const from = args.from ?? Deno.env.get("EMAIL_FROM") ?? "no-reply@yourdomain.com";
  const host = `email.${creds.region}.amazonaws.com`;
  const payload = JSON.stringify({
    FromEmailAddress: from,
    Destination: { ToAddresses: [args.to] },
    Content: { Simple: { Subject: { Data: args.subject }, Body: { Html: { Data: args.body } } } },
  });
  const r = await signedFetch(creds, "ses", host, "/v2/email/outbound-emails", payload);
  return { success: r.ok, status: r.status };
}
