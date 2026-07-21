// SMTP email provider (EMAIL_PROVIDER=smtp). Handy for local dev with Mailhog, or any
// SMTP relay in production. Uses denomailer. For Mailhog: SMTP_HOST=mailhog, SMTP_PORT=1025,
// no auth/TLS.
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

export async function smtpSend(args: { to: string; subject: string; body: string; from?: string }) {
  const host = Deno.env.get("SMTP_HOST") ?? "localhost";
  const port = Number(Deno.env.get("SMTP_PORT") ?? "1025");
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  const tls = (Deno.env.get("SMTP_TLS") ?? "false") === "true";
  const from = args.from ?? Deno.env.get("EMAIL_FROM") ?? "no-reply@yourdomain.com";

  const client = new SMTPClient({
    connection: {
      hostname: host,
      port,
      tls,
      ...(user && pass ? { auth: { username: user, password: pass } } : {}),
    },
  });
  try {
    await client.send({ from, to: args.to, subject: args.subject, html: args.body });
    return { success: true, provider: "smtp" };
  } finally {
    await client.close();
  }
}
