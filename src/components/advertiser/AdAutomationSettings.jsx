import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import {
  Bot, Mail, RefreshCw, DollarSign, Brain, Zap, CheckCircle2,
  Loader2, Info, Clock, Sparkles, ShieldCheck, FileText, TrendingUp, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';

const AUTOMATION_GROUPS = [
  {
    group: '📧 Communication',
    items: [
      {
        key: 'ad_digest_enabled',
        icon: <Mail className="w-5 h-5 text-blue-400" />,
        title: 'Daily AI Campaign Digest',
        description: 'Every morning, AI analyzes all your campaigns and emails you 3 specific insights + your full portfolio snapshot with CTR trends and budget burn rate.',
        badge: 'Email · Daily 8am ET',
        badgeColor: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
      },
      {
        key: 'ad_budget_alerts',
        icon: <DollarSign className="w-5 h-5 text-orange-400" />,
        title: 'Predictive Budget Alert',
        description: 'AI calculates your average daily spend and emails you a warning 3 days before your balance runs out — so you never get caught with paused campaigns.',
        badge: 'Email · Auto-triggered',
        badgeColor: 'bg-orange-500/10 border-orange-500/20 text-orange-300',
        requires: 'ad_digest_enabled',
      },
    ],
  },
  {
    group: '🤖 Auto-Actions',
    items: [
      {
        key: 'ad_auto_tagline_refresh',
        icon: <RefreshCw className="w-5 h-5 text-purple-400" />,
        title: 'Auto Tagline Refresh',
        description: 'When a campaign\'s CTR drops below 1% (after 50+ clicks), AI automatically generates and applies a better tagline. Old tagline is saved in version history.',
        badge: 'Auto-apply · Nightly',
        badgeColor: 'bg-purple-500/10 border-purple-500/20 text-purple-300',
      },
      {
        key: 'smart_bidding',
        icon: <TrendingUp className="w-5 h-5 text-green-400" />,
        title: 'Auto Counter-Bid Engine',
        description: 'Every 6 hours, checks if a competitor has outbid your active campaigns and automatically bumps your bid by your configured margin to stay competitive. Never exceeds your tier maximum.',
        badge: 'Auto-bid · Every 6h',
        badgeColor: 'bg-green-500/10 border-green-500/20 text-green-300',
        extraField: {
          key: 'counter_bid_margin',
          label: 'Bid bump margin ($)',
          type: 'number',
          step: 0.01,
          min: 0.01,
          max: 0.25,
          default: 0.05,
          hint: 'How much to outbid the competitor by (e.g. $0.05)',
        },
        requiresSmartBidding: true,
      },
    ],
  },
  {
    group: '📊 Reporting',
    items: [
      {
        key: 'ad_report_schedule',
        icon: <FileText className="w-5 h-5 text-yellow-400" />,
        title: 'Scheduled Auto-Reports',
        description: 'Automatically email yourself a performance + spend report on a set cadence. No clicking required — reports land in your inbox on schedule.',
        badge: 'Email · Configurable',
        badgeColor: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300',
        extraField: {
          key: 'ad_report_frequency',
          label: 'Report frequency',
          type: 'select',
          options: [
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly (Mondays)' },
            { value: 'monthly', label: 'Monthly (1st)' },
          ],
          default: 'weekly',
        },
      },
    ],
  },
  {
    group: '🛡️ Compliance',
    items: [
      {
        key: 'ad_auto_review_notify',
        icon: <ShieldCheck className="w-5 h-5 text-red-400" />,
        title: 'AI Ad Auto-Review Notifications',
        description: 'When you submit a new ad, AI instantly scores it for brand safety, tagline quality, and URL legitimacy — then emails you the result with specific improvement suggestions.',
        badge: 'Auto · On submission',
        badgeColor: 'bg-red-500/10 border-red-500/20 text-red-300',
        alwaysOn: true,
        alwaysOnNote: 'This runs automatically for all new ad submissions.',
      },
    ],
  },
];

function Toggle({ enabled, onChange, disabled }) {
  return (
    <button
      disabled={disabled}
      onClick={onChange}
      className={`relative w-12 h-6 rounded-full transition-all flex-shrink-0 ${
        enabled ? 'bg-yellow-500' : 'bg-gray-700'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
        enabled ? 'left-6' : 'left-0.5'
      }`} />
    </button>
  );
}

function AutomationRow({ config, prefs, onToggle, onPrefChange, saving }) {
  const enabled = config.alwaysOn ? true : !!prefs[config.key];
  const depMet = config.requires ? !!prefs[config.requires] : true;
  const isDisabled = config.alwaysOn || !depMet || saving;

  return (
    <div className={`bg-gray-900 border rounded-2xl p-4 transition-all ${
      enabled && !config.alwaysOn ? 'border-yellow-500/30' : config.alwaysOn ? 'border-green-500/20' : 'border-gray-700'
    } ${!depMet ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-white font-bold text-sm">{config.title}</p>
              <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{config.description}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <Badge className={`text-[10px] border ${config.badgeColor}`}>
                  <Clock className="w-2.5 h-2.5 mr-1" />{config.badge}
                </Badge>
                {config.alwaysOn && (
                  <Badge className="text-[10px] border bg-green-500/10 border-green-500/20 text-green-300">
                    <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Always Active
                  </Badge>
                )}
                {enabled && !config.alwaysOn && (
                  <Badge className="text-[10px] border bg-green-500/10 border-green-500/20 text-green-300">
                    <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Active
                  </Badge>
                )}
                {!depMet && (
                  <Badge className="text-[10px] border bg-gray-700 border-gray-600 text-gray-500">
                    <Info className="w-2.5 h-2.5 mr-1" /> Requires Daily Digest
                  </Badge>
                )}
              </div>

              {/* Extra field (frequency / margin) — only show when enabled */}
              {config.extraField && enabled && !config.alwaysOn && (
                <div className="mt-3">
                  <label className="text-xs text-gray-500 font-bold block mb-1">{config.extraField.label}</label>
                  {config.extraField.type === 'select' ? (
                    <select
                      value={prefs[config.extraField.key] || config.extraField.default}
                      onChange={e => onPrefChange(config.extraField.key, e.target.value)}
                      className="bg-gray-800 border border-gray-600 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-yellow-500/50"
                    >
                      {config.extraField.options.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-xs">$</span>
                      <input
                        type="number"
                        step={config.extraField.step}
                        min={config.extraField.min}
                        max={config.extraField.max}
                        value={prefs[config.extraField.key] ?? config.extraField.default}
                        onChange={e => onPrefChange(config.extraField.key, parseFloat(e.target.value) || config.extraField.default)}
                        className="w-20 bg-gray-800 border border-gray-600 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-yellow-500/50"
                      />
                      {config.extraField.hint && <span className="text-gray-600 text-[10px]">{config.extraField.hint}</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
            {!config.alwaysOn && (
              <Toggle enabled={enabled} onChange={() => onToggle(config.key, !enabled)} disabled={isDisabled} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdAutomationSettings({ user, onUserUpdate }) {
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState({
    ad_digest_enabled: user?.ad_digest_enabled || false,
    ad_budget_alerts: user?.ad_budget_alerts || false,
    ad_auto_tagline_refresh: user?.ad_auto_tagline_refresh || false,
    smart_bidding: user?.smart_bidding || false,
    counter_bid_margin: user?.counter_bid_margin || 0.05,
    ad_report_schedule: user?.ad_report_schedule || false,
    ad_report_frequency: user?.ad_report_frequency || 'weekly',
  });

  const activeCount = ['ad_digest_enabled', 'ad_budget_alerts', 'ad_auto_tagline_refresh', 'smart_bidding', 'ad_report_schedule']
    .filter(k => prefs[k]).length + 1; // +1 for always-on auto-reviewer

  const handleToggle = async (key, value) => {
    const updated = { ...prefs, [key]: value };
    // Disable dependents if master is turned off
    if (key === 'ad_digest_enabled' && !value) {
      updated.ad_budget_alerts = false;
    }
    setPrefs(updated);
    setSaving(true);
    await base44.auth.updateMe(updated);
    setSaving(false);
    if (onUserUpdate) onUserUpdate(updated);
    const names = {
      ad_digest_enabled: 'Daily Digest',
      ad_budget_alerts: 'Budget Alerts',
      ad_auto_tagline_refresh: 'Auto Tagline Refresh',
      smart_bidding: 'Auto Counter-Bid',
      ad_report_schedule: 'Scheduled Reports',
    };
    toast.success(value ? `✓ ${names[key] || key} enabled` : `${names[key] || key} disabled`);
  };

  const handlePrefChange = async (key, value) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    setSaving(true);
    await base44.auth.updateMe(updated);
    setSaving(false);
    if (onUserUpdate) onUserUpdate(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/5 border border-yellow-500/20 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="flex-1">
            <p className="text-white font-black">100% AI Automation</p>
            <p className="text-gray-400 text-xs">Set it once. AI runs everything automatically.</p>
          </div>
          <Badge className="bg-yellow-500/20 border-yellow-500/40 text-yellow-300 text-xs">
            <Zap className="w-3 h-3 mr-1" /> {activeCount} active
          </Badge>
        </div>
        {/* Loop diagram */}
        <div className="bg-gray-950/50 rounded-xl px-3 py-2.5">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-400" /> Nightly automation loop
          </p>
          <div className="flex flex-wrap items-center gap-1 text-[11px] text-gray-400">
            {['📸 Snapshot all campaigns', '🧠 AI analyzes performance', '✍️ Refresh low-CTR taglines', '💰 Counter-bid if outbid', '⚠️ Budget alert if low', '📧 Email digest'].map((step, i, arr) => (
              <React.Fragment key={i}>
                <span className="bg-gray-800 rounded px-1.5 py-0.5">{step}</span>
                {i < arr.length - 1 && <span className="text-gray-700">→</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Groups */}
      {AUTOMATION_GROUPS.map(group => (
        <div key={group.group} className="space-y-3">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">{group.group}</p>
          {group.items.map(config => (
            <AutomationRow
              key={config.key}
              config={config}
              prefs={prefs}
              onToggle={handleToggle}
              onPrefChange={handlePrefChange}
              saving={saving}
            />
          ))}
        </div>
      ))}

      {/* Always-on snapshot note */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-start gap-2.5">
        <Brain className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-gray-400">Nightly Memory Snapshots — Always On</p>
          <p className="text-gray-600 text-xs mt-0.5">
            Regardless of the toggles above, the system automatically saves nightly performance snapshots to your AI Learning History.
            These power the Campaign Chat, Launch Forecaster, and Business Overview sparklines.
          </p>
        </div>
      </div>

      {saving && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="w-3 h-3 animate-spin" /> Saving preferences...
        </div>
      )}
    </div>
  );
}