import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * Checks a respondent's IP address against IP quality/proxy detection APIs.
 * Uses ipapi.co (free, no key needed) + ipqualityscore heuristics.
 * Returns: { is_suspicious, risk_score, reasons[], action: 'allow'|'flag'|'block' }
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { response_id, survey_id, ip_address, user_agent, fingerprint } = await req.json();

    const reasons = [];
    let riskScore = 0;

    // 1. Resolve IP geolocation & proxy/VPN detection via ipapi.co (free tier)
    let ipData = null;
    if (ip_address && ip_address !== '127.0.0.1' && ip_address !== 'unknown') {
      try {
        const ipRes = await fetch(`https://ipapi.co/${ip_address}/json/`, {
          headers: { 'User-Agent': 'SurveyFraudChecker/1.0' }
        });
        if (ipRes.ok) ipData = await ipRes.json();
      } catch { /* skip if unavailable */ }
    }

    if (ipData) {
      // Check for known hosting/datacenter AS numbers (common VPN/proxy ranges)
      const org = (ipData.org || '').toLowerCase();
      const asn = (ipData.asn || '').toLowerCase();
      const vpnKeywords = ['vpn', 'proxy', 'hosting', 'datacenter', 'cloud', 'digitalocean', 'linode', 'vultr',
        'amazon', 'google cloud', 'microsoft azure', 'ovh', 'hetzner', 'tor', 'anonymous'];

      const isDatacenter = vpnKeywords.some(kw => org.includes(kw) || asn.includes(kw));
      if (isDatacenter) {
        riskScore += 45;
        reasons.push(`IP org "${ipData.org}" appears to be a datacenter/VPN provider`);
      }

      // Bogon / reserved IP
      if (ipData.bogon) {
        riskScore += 60;
        reasons.push('Bogon/reserved IP address detected');
      }

      // Country mismatch heuristic (if timezone offset seems wrong — basic check)
      if (!ipData.country_code) {
        riskScore += 15;
        reasons.push('IP geolocation lookup returned no country');
      }
    } else if (ip_address && ip_address !== 'unknown') {
      // Could not resolve IP
      riskScore += 10;
      reasons.push('IP geolocation unavailable');
    }

    // 2. User-agent analysis
    if (user_agent) {
      const ua = user_agent.toLowerCase();
      const botSignals = ['bot', 'crawler', 'spider', 'headless', 'phantom', 'selenium', 'puppeteer', 'playwright', 'curl', 'wget', 'python-requests'];
      const isBotUA = botSignals.some(s => ua.includes(s));
      if (isBotUA) {
        riskScore += 70;
        reasons.push('Automated/bot user-agent detected');
      }

      // Headless Chrome signal
      if (ua.includes('headlesschrome') || ua.includes('headless chrome')) {
        riskScore += 80;
        reasons.push('Headless browser detected');
      }
    }

    // 3. Fingerprint duplication check (same fingerprint submitted to this survey before)
    if (fingerprint && survey_id) {
      const existingWithFingerprint = await base44.asServiceRole.entities.PPCSurveyResponse.filter({
        survey_id,
        device_fingerprint: fingerprint,
        completed: true,
      });
      // Exclude current response
      const dupes = existingWithFingerprint.filter(r => r.id !== response_id);
      if (dupes.length > 0) {
        riskScore += 85;
        reasons.push(`Device fingerprint already submitted ${dupes.length} response(s) to this survey`);
      }
    }

    // 4. Determine action
    let action = 'allow';
    if (riskScore >= 70) action = 'block';
    else if (riskScore >= 35) action = 'flag';

    const isSuspicious = action !== 'allow';

    // 5. Update the response record if suspicious
    if (isSuspicious && response_id) {
      await base44.asServiceRole.entities.PPCSurveyResponse.update(response_id, {
        fraud_risk_score: riskScore,
        fraud_reasons: reasons,
        fraud_action: action,
        is_flagged: action === 'flag',
        is_blocked: action === 'block',
      });
    }

    // 6. Store fingerprint on response for future deduplication
    if (fingerprint && response_id) {
      await base44.asServiceRole.entities.PPCSurveyResponse.update(response_id, {
        device_fingerprint: fingerprint,
      });
    }

    return Response.json({
      success: true,
      is_suspicious: isSuspicious,
      risk_score: riskScore,
      action,
      reasons,
      ip_country: ipData?.country_code,
      ip_org: ipData?.org,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});