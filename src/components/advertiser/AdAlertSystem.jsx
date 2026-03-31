import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, AlertTriangle, TrendingDown, DollarSign, Zap, CheckCircle, X, Settings, Mail, BellOff } from 'lucide-react';
import { toast } from 'sonner';

const CTR_THRESHOLD = 2.0; // percent
const BUDGET_THRESHOLD = 0.80; // 80%

function computeAlerts(ads, adBalance, budgetLimit) {
  const alerts = [];

  ads.forEach(ad => {
    const ctr = ad.total_clicks > 0 && ad.surveys_started > 0
      ? ((ad.surveys_completed / ad.total_clicks) * 100)
      : null;
    const budgetUsed = ad.budget_limit > 0 ? (ad.total_spent || 0) / ad.budget_limit : 0;

    if (ctr !== null && ctr < CTR_THRESHOLD && ad.status === 'active') {
      alerts.push({
        id: `ctr-${ad.id}`,
        type: 'ctr_low',
        severity: 'warning',
        adId: ad.id,
        adName: ad.brand_name,
        message: `CTR dropped to ${ctr.toFixed(1)}% (below ${CTR_THRESHOLD}% threshold)`,
        suggestions: [
          'Try a more eye-catching thumbnail image',
          'Update your tagline to be more compelling',
          'Increase your bid to appear in higher-traffic grid cells',
          'Consider running an A/B test with a different creative',
        ],
      });
    }

    if (budgetUsed >= BUDGET_THRESHOLD && ad.status === 'active') {
      const remaining = (ad.budget_limit - (ad.total_spent || 0)).toFixed(2);
      alerts.push({
        id: `budget-${ad.id}`,
        type: 'budget_low',
        severity: budgetUsed >= 0.95 ? 'critical' : 'warning',
        adId: ad.id,
        adName: ad.brand_name,
        message: `Budget ${Math.round(budgetUsed * 100)}% used — $${remaining} remaining`,
        suggestions: [
          'Top up your ad budget to keep the campaign running',
          'Reduce your cost-per-survey bid to extend reach',
          'Pause lower-performing ads to concentrate budget',
        ],
      });
    }
  });

  return alerts;
}

export default function AdAlertSystem({ ads, adBalance, onTopUp }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ad_dismissed_alerts') || '[]'); } catch { return []; }
  });
  const [expandedAlert, setExpandedAlert] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);

  const alerts = computeAlerts(ads, adBalance).filter(a => !dismissed.includes(a.id));

  const dismiss = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem('ad_dismissed_alerts', JSON.stringify(next));
  };

  const handleOneClickOptimize = async (alert) => {
    if (alert.type === 'ctr_low') {
      await base44.entities.AdListing.update(alert.adId, { bid_amount: 0.55 });
      toast.success(`Bid increased for "${alert.adName}" — moving to higher-traffic cells`);
    } else if (alert.type === 'budget_low') {
      onTopUp();
    }
    dismiss(alert.id);
  };

  if (alerts.length === 0) return null;

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;

  return (
    <div className="mb-6 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-bold text-white">Performance Alerts</span>
          <Badge className={`text-xs ${criticalCount > 0 ? 'bg-red-600' : 'bg-yellow-600'} text-white`}>
            {alerts.length}
          </Badge>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="text-gray-500 hover:text-white transition-colors"
          title="Alert settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Settings drawer */}
      {showSettings && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm">
          <p className="text-gray-300 font-bold mb-3">Alert Settings</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-400">
              <Mail className="w-4 h-4" />
              <span>Email notifications</span>
            </div>
            <button
              onClick={() => { setEmailAlerts(!emailAlerts); toast.success(emailAlerts ? 'Email alerts disabled' : 'Email alerts enabled'); }}
              className={`w-10 h-5 rounded-full transition-all relative ${emailAlerts ? 'bg-yellow-500' : 'bg-gray-600'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${emailAlerts ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
          <p className="text-gray-600 text-xs mt-2">CTR threshold: {CTR_THRESHOLD}% · Budget warning: {BUDGET_THRESHOLD * 100}%</p>
        </div>
      )}

      {/* Alert cards */}
      {alerts.map(alert => (
        <div
          key={alert.id}
          className={`border rounded-2xl overflow-hidden transition-all ${
            alert.severity === 'critical'
              ? 'border-red-600/60 bg-red-950/30'
              : 'border-yellow-600/40 bg-yellow-950/20'
          }`}
        >
          <div className="flex items-start gap-3 p-4">
            <div className={`mt-0.5 flex-shrink-0 ${alert.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'}`}>
              {alert.type === 'ctr_low' ? <TrendingDown className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-white font-bold text-sm">{alert.adName}</span>
                <Badge className={`text-[10px] ${alert.severity === 'critical' ? 'bg-red-700' : 'bg-yellow-700'} text-white`}>
                  {alert.severity === 'critical' ? '⚠ Critical' : '⚡ Warning'}
                </Badge>
              </div>
              <p className="text-gray-300 text-xs">{alert.message}</p>

              {/* One-click suggestions */}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black text-xs h-7 gap-1"
                  onClick={() => handleOneClickOptimize(alert)}
                >
                  <Zap className="w-3 h-3" />
                  {alert.type === 'ctr_low' ? 'Boost Bid Now' : 'Top Up Budget'}
                </Button>
                <button
                  className="text-xs text-gray-400 hover:text-white underline"
                  onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                >
                  {expandedAlert === alert.id ? 'Hide tips' : 'See optimization tips'}
                </button>
              </div>

              {/* Expanded suggestions */}
              {expandedAlert === alert.id && (
                <div className="mt-3 space-y-1.5">
                  {alert.suggestions.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-gray-400">
                      <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => dismiss(alert.id)} className="text-gray-600 hover:text-gray-400 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}