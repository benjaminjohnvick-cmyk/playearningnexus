import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Monitors integration health and sends admin alerts for any failures
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const checks = [];

    // Check PayPal connectivity
    try {
      const paypalRes = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${Deno.env.get('PAYPAL_CLIENT_ID')}:${Deno.env.get('PAYPAL_SECRET_KEY')}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
      checks.push({ service: 'paypal', status: paypalRes.ok ? 'healthy' : 'degraded', code: paypalRes.status });
    } catch (e) {
      checks.push({ service: 'paypal', status: 'error', error: e.message });
    }

    // Check BitLabs
    try {
      const bitlabsRes = await fetch('https://api.bitlabs.ai/v2/client/surveys?platform=SURVEY', {
        headers: { 'X-Api-Token': Deno.env.get('BITLABS_API_KEY') || '' }
      });
      checks.push({ service: 'bitlabs', status: bitlabsRes.status < 500 ? 'healthy' : 'degraded', code: bitlabsRes.status });
    } catch (e) {
      checks.push({ service: 'bitlabs', status: 'error', error: e.message });
    }

    // Alert admin on failures
    const failures = checks.filter(c => c.status === 'error' || c.status === 'degraded');
    if (failures.length > 0) {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins) {
        if (admin.email) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: admin.email,
            subject: `⚠️ GamerGain Integration Alert: ${failures.map(f => f.service).join(', ')} degraded`,
            body: `Integration health check failed:\n\n${failures.map(f => `${f.service}: ${f.status} (${f.error || f.code})`).join('\n')}\n\nPlease check API keys and service status.`,
          });
        }
      }
    }

    return Response.json({ success: true, checks });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});