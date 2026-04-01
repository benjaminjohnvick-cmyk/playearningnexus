import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bot, Mail, RefreshCw, DollarSign, Brain, Zap, CheckCircle2,
  Loader2, Info, Clock, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

const AUTOMATIONS = [
  {
    key: 'ad_digest_enabled',
    icon: <Mail className="w-5 h-5 text-blue-400" />,
    title: 'Daily AI Campaign Digest',
    description: 'Every morning, AI analyzes all your campaigns and emails you 3 specific insights + your portfolio snapshot. Includes CTR trends, budget burn rate, and the #1 action to take today.',
    badge: 'Email · Daily 8am',
    badgeColor: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
    always: true, // this one always runs if digest is on
  },
  {
    key: 'ad_budget_alerts',
    icon: <DollarSign className="w-5 h-5 text-orange-400" />,
    title: 'Predictive Budget Alert',
    description: 'AI calculates your average daily spend and sends an email warning 3 days before your balance runs out — so you never get caught with paused campaigns.',
    badge: 'Email · Auto-triggered',
    badgeColor: 'bg-orange-500/10 border-orange-500/20 text-orange-300',
    requires: 'ad_digest_enabled',
  },
  {
    key: 'ad_auto_tagline_refresh',
    icon: <RefreshCw className="w-5 h-5 text-purple-400" />,
    title: 'Auto Tagline Refresh',
    description: 'When a campaign\'s CTR drops below 1% (after 50+ clicks), AI automatically generates and applies a new high-converting tagline. Old tagline is saved in the Creative Studio history.',
    badge: 'Auto-apply · Nightly',
    badgeColor: 'bg-purple-500/10 border-purple-500/20 text-purple-300',
    requires: 'ad_digest_enabled',
  },
];

function AutomationRow({ config, enabled, dependencyMet, onChange, saving }) {
  const isDisabled = config.requires && !dependencyMet;

  return (
    <div className={`bg-gray-900 border rounded-2xl p-5 transition-all ${
      enabled ? 'border-yellow-500/30' : 'border-gray-700'
    } ${isDisabled ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          enabled ? 'bg-gray-800' : 'bg-gray-800/50'
        }`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-white font-bold text-sm">{config.title}</p>
              <p className="text-gray-400 text-xs mt-1 leading-relaxed">{config.description}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={`text-[10px] border ${config.badgeColor}`}>
                  <Clock className="w-2.5 h-2.5 mr-1" />
                  {config.badge}
                </Badge>
                {enabled && (
                  <Badge className="text-[10px] border bg-green-500/10 border-green-500/20 text-green-300">
                    <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Active
                  </Badge>
                )}
                {isDisabled && (
                  <Badge className="text-[10px] border bg-gray-700 border-gray-600 text-gray-500">
                    <Info className="w-2.5 h-2.5 mr-1" /> Requires Daily Digest
                  </Badge>
                )}
              </div>
            </div>
            {/* Toggle */}
            <button
              disabled={saving || isDisabled}
              onClick={() => onChange(config.key, !enabled)}
              className={`relative w-12 h-6 rounded-full transition-all flex-shrink-0 mt-0.5 ${
                enabled ? 'bg-yellow-500' : 'bg-gray-700'
              } ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                enabled ? 'left-6' : 'left-0.5'
              }`} />
            </button>
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
  });

  const handleToggle = async (key, value) => {
    const updated = { ...prefs, [key]: value };
    // If disabling the master toggle, disable dependents too
    if (key === 'ad_digest_enabled' && !value) {
      updated.ad_budget_alerts = false;
      updated.ad_auto_tagline_refresh = false;
    }
    setPrefs(updated);
    setSaving(true);
    await base44.auth.updateMe(updated);
    setSaving(false);
    if (onUserUpdate) onUserUpdate(updated);
    toast.success(value ? `✓ ${key === 'ad_digest_enabled' ? 'Daily Digest' : key === 'ad_budget_alerts' ? 'Budget Alerts' : 'Auto Tagline Refresh'} enabled` : 'Automation disabled');
  };

  const activeCount = Object.values(prefs).filter(Boolean).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/5 border border-yellow-500/20 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <p className="text-white font-black">100% AI Automation</p>
            <p className="text-gray-400 text-xs">Set it once. AI runs everything automatically.</p>
          </div>
          {activeCount > 0 && (
            <Badge className="ml-auto bg-yellow-500/20 border-yellow-500/40 text-yellow-300 text-xs">
              <Zap className="w-3 h-3 mr-1" /> {activeCount} active
            </Badge>
          )}
        </div>
        <p className="text-gray-500 text-xs leading-relaxed">
          These automations run every night at 8am ET without any action from you. 
          They analyze your real campaign data, take action where configured, and email you a digest.
          All three together form a complete hands-free campaign management loop.
        </p>
      </div>

      {/* How it works */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-purple-400" /> Nightly Automation Loop
        </p>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 flex-wrap">
          <span className="bg-gray-800 rounded-lg px-2 py-1">📸 Snapshot all campaigns</span>
          <span className="text-gray-700">→</span>
          <span className="bg-gray-800 rounded-lg px-2 py-1">🧠 AI analyzes performance</span>
          <span className="text-gray-700">→</span>
          <span className="bg-gray-800 rounded-lg px-2 py-1">✍️ Refresh low-CTR taglines</span>
          <span className="text-gray-700">→</span>
          <span className="bg-gray-800 rounded-lg px-2 py-1">⚠️ Budget warning if needed</span>
          <span className="text-gray-700">→</span>
          <span className="bg-gray-800 rounded-lg px-2 py-1">📧 Email digest to you</span>
        </div>
      </div>

      {/* Automation rows */}
      {AUTOMATIONS.map(config => (
        <AutomationRow
          key={config.key}
          config={config}
          enabled={prefs[config.key]}
          dependencyMet={config.requires ? prefs[config.requires] : true}
          onChange={handleToggle}
          saving={saving}
        />
      ))}

      {/* Nightly snapshot note */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-start gap-2.5">
        <Brain className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-gray-400">Nightly Memory Snapshots — Always On</p>
          <p className="text-gray-600 text-xs mt-0.5">
            Regardless of the toggles above, the system automatically saves nightly performance snapshots to your AI Learning History.
            This powers the Campaign Chat, Launch Forecaster, and Business Overview sparklines.
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