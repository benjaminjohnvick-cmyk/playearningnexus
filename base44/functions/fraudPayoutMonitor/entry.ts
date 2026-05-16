import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user_id, payout_amount } = await req.json();

    const user = await base44.asServiceRole.entities.User.get(user_id);

    // Check for suspicious payout patterns
    const recentPayouts = await base44.asServiceRole.entities.Payout.filter({
      recipient_id: user_id,
      completed_date: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
    });

    // Get recent UX sessions
    const recentSessions = await base44.asServiceRole.entities.UXSessionRecording.filter({
      user_id,
      recorded_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
    });

    let fraudScore = 0;
    const fraudSignals = [];

    // Signal 1: Rapid payout requests (more than 3 in 24 hours)
    if (recentPayouts.length > 3) {
      fraudScore += 20;
      fraudSignals.push(`Rapid payout requests: ${recentPayouts.length} in last 24h`);
    }

    // Signal 2: Unusual payout amount (5x normal average)
    const avgPayoutAmount = recentPayouts.length > 0
      ? recentPayouts.reduce((sum, p) => sum + p.amount, 0) / recentPayouts.length
      : 0;

    if (avgPayoutAmount > 0 && payout_amount > avgPayoutAmount * 5) {
      fraudScore += 15;
      fraudSignals.push(`Unusual payout amount: $${payout_amount} vs avg $${avgPayoutAmount.toFixed(2)}`);
    }

    // Signal 3: High fraud scores in recent UX sessions
    const highFraudSessions = recentSessions.filter(s => s.fraud_score >= 70);
    if (highFraudSessions.length > 0) {
      fraudScore += highFraudSessions.length * 10;
      fraudSignals.push(`High fraud UX sessions: ${highFraudSessions.length} sessions with score >= 70`);
    }

    // Signal 4: Copy/paste or auto-fill detected in survey sessions
    const copySessions = recentSessions.filter(s => s.copy_paste_detected || s.auto_fill_detected);
    if (copySessions.length > 0) {
      fraudScore += 25;
      fraudSignals.push(`Auto-fill/copy-paste detected: ${copySessions.length} sessions`);
    }

    // Signal 5: Tab switching during survey (indicates multi-accounting)
    const tabSwitchers = recentSessions.filter(s => s.tab_switches > 5);
    if (tabSwitchers.length > 0) {
      fraudScore += 15;
      fraudSignals.push(`Excessive tab switching detected in ${tabSwitchers.length} sessions`);
    }

    // Signal 6: Irregular survey completion speed
    const fastSessions = recentSessions.filter(s => s.session_duration_seconds < 30);
    if (fastSessions.length > recentSessions.length * 0.5) {
      fraudScore += 10;
      fraudSignals.push(`Suspicious session speed: ${fastSessions.length}/${recentSessions.length} under 30 seconds`);
    }

    // If fraud score is high, freeze account and create dispute requirement
    if (fraudScore >= 60) {
      const lockout = await base44.asServiceRole.entities.LockoutSession.create({
        user_id,
        status: 'active',
        reason: 'fraud_detected_payout',
        requires_dispute: true,
        fraud_score: fraudScore,
        fraud_signals: fraudSignals
      });

      // Create fraud report
      await base44.asServiceRole.entities.FraudReport.create({
        report_type: 'payout_fraud_detected',
        user_id,
        fraud_score: fraudScore,
        status: 'flagged',
        details: fraudSignals.join('\n')
      });

      // Notify user
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: '⚠️ Account Security Alert - Temporary Freeze',
        body: `Your account has been temporarily frozen due to suspicious payout activity. 
        
Fraud Signals Detected:
${fraudSignals.map(s => `• ${s}`).join('\n')}

To regain access, please submit a dispute with evidence through your account dashboard. Our team will review and respond within 24 hours.

Payout Amount: $${payout_amount}
Fraud Score: ${fraudScore}/100`
      });

      return Response.json({
        action: 'frozen',
        fraud_score: fraudScore,
        signals: fraudSignals,
        lockout_id: lockout.id
      });
    }

    // If moderate risk, flag for review but allow payout
    if (fraudScore >= 40) {
      await base44.asServiceRole.entities.FraudReport.create({
        report_type: 'payout_suspicious',
        user_id,
        fraud_score: fraudScore,
        status: 'under_review',
        details: fraudSignals.join('\n')
      });

      return Response.json({
        action: 'flagged_for_review',
        fraud_score: fraudScore,
        signals: fraudSignals,
        allowed: true
      });
    }

    // Clean transaction
    return Response.json({
      action: 'approved',
      fraud_score: fraudScore,
      allowed: true
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});