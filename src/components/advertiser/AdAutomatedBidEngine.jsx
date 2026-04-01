import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Plus, Trash2, Play, Pause, Clock, TrendingDown, TrendingUp, ToggleLeft, ToggleRight, AlertCircle, CheckCircle2 } from 'lucide-react';

const TRIGGER_TYPES = [
  { value: 'ctr_below', label: 'CTR drops below', unit: '%', defaultVal: 1.5 },
  { value: 'ctr_above', label: 'CTR rises above', unit: '%', defaultVal: 5 },
  { value: 'spend_above', label: 'Daily spend exceeds', unit: '$', defaultVal: 10 },
  { value: 'completions_below', label: 'Daily completions below', unit: 'surveys', defaultVal: 5 },
  { value: 'budget_below', label: 'Remaining budget below', unit: '$', defaultVal: 20 },
];

const ACTION_TYPES = [
  { value: 'reduce_bid_pct', label: 'Reduce bid by', unit: '%' },
  { value: 'increase_bid_pct', label: 'Increase bid by', unit: '%' },
  { value: 'pause_ad', label: 'Pause ad campaign', unit: '' },
  { value: 'set_bid_abs', label: 'Set bid to exactly', unit: '$' },
];

const SCHEDULE_PRESETS = [
  { label: 'Weekends +20%', days: [0, 6], action: 'increase_bid_pct', value: 20 },
  { label: 'Weekdays -10%', days: [1, 2, 3, 4, 5], action: 'reduce_bid_pct', value: 10 },
  { label: 'Peak Hours (6–9pm)', hours: [18, 19, 20], action: 'increase_bid_pct', value: 15 },
  { label: 'Off-Peak (1–5am)', hours: [1, 2, 3, 4], action: 'reduce_bid_pct', value: 25 },
];

function evaluateTrigger(trigger, ad) {
  const ctr = ad.total_clicks > 0 ? (ad.surveys_completed / ad.total_clicks) * 100 : 0;
  const budgetLeft = (ad.budget_limit || 100) - (ad.total_spent || 0);
  switch (trigger.type) {
    case 'ctr_below': return ctr < trigger.threshold;
    case 'ctr_above': return ctr > trigger.threshold;
    case 'spend_above': return (ad.total_spent || 0) > trigger.threshold;
    case 'completions_below': return (ad.surveys_completed || 0) < trigger.threshold;
    case 'budget_below': return budgetLeft < trigger.threshold;
    default: return false;
  }
}

function applyAction(ad, action) {
  let newBid = ad.bid_amount;
  switch (action.type) {
    case 'reduce_bid_pct': newBid = Math.max(0.20, ad.bid_amount * (1 - action.value / 100)); break;
    case 'increase_bid_pct': newBid = Math.min(1.50, ad.bid_amount * (1 + action.value / 100)); break;
    case 'set_bid_abs': newBid = Math.max(0.20, Math.min(1.50, action.value)); break;
    case 'pause_ad': return { status: 'paused' };
    default: break;
  }
  return { bid_amount: parseFloat(newBid.toFixed(2)) };
}

export default function AdAutomatedBidEngine({ ads, onRefresh }) {
  const [rules, setRules] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [log, setLog] = useState([]);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [engineRunning, setEngineRunning] = useState(false);
  const engineRef = useRef(null);

  // New rule form state
  const [ruleAd, setRuleAd] = useState('all');
  const [ruleTrigger, setRuleTrigger] = useState('ctr_below');
  const [ruleThreshold, setRuleThreshold] = useState(1.5);
  const [ruleAction, setRuleAction] = useState('reduce_bid_pct');
  const [ruleActionVal, setRuleActionVal] = useState(10);

  // New schedule form
  const [schedAd, setSchedAd] = useState('all');
  const [schedPreset, setSchedPreset] = useState(0);
  const [schedCustomAction, setSchedCustomAction] = useState('increase_bid_pct');
  const [schedCustomVal, setSchedCustomVal] = useState(20);

  const addLog = (msg, type = 'info') => {
    setLog(prev => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 49)]);
  };

  const runEngine = async () => {
    if (rules.length === 0 && schedules.length === 0) {
      addLog('No rules or schedules configured.', 'warn');
      return;
    }
    addLog('Engine cycle started — evaluating rules...', 'info');
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();
    let actionsCount = 0;

    for (const ad of ads) {
      // Evaluate trigger rules
      for (const rule of rules.filter(r => r.active && (r.adId === 'all' || r.adId === ad.id))) {
        const triggered = evaluateTrigger(rule, ad);
        if (triggered) {
          const update = applyAction(ad, rule);
          await base44.entities.AdListing.update(ad.id, update);
          const actionLabel = ACTION_TYPES.find(a => a.value === rule.action)?.label || rule.action;
          addLog(`✓ Rule fired on "${ad.brand_name}": ${actionLabel} ${rule.actionValue}${ACTION_TYPES.find(a => a.value === rule.action)?.unit || ''}`, 'success');
          actionsCount++;
        }
      }

      // Evaluate schedules
      for (const sched of schedules.filter(s => s.active && (s.adId === 'all' || s.adId === ad.id))) {
        const matchesDay = sched.days?.includes(currentDay);
        const matchesHour = sched.hours?.includes(currentHour);
        if (matchesDay || matchesHour) {
          const update = applyAction(ad, { type: sched.action, value: sched.value });
          await base44.entities.AdListing.update(ad.id, update);
          addLog(`⏰ Schedule applied to "${ad.brand_name}": ${sched.label}`, 'success');
          actionsCount++;
        }
      }
    }

    if (actionsCount === 0) addLog('Cycle complete — no rules triggered.', 'info');
    else { addLog(`Cycle complete — ${actionsCount} action(s) applied.`, 'success'); onRefresh?.(); }
  };

  const toggleEngine = () => {
    if (engineRunning) {
      clearInterval(engineRef.current);
      setEngineRunning(false);
      addLog('Auto engine stopped.', 'warn');
    } else {
      setEngineRunning(true);
      addLog('Auto engine started — running every 60s.', 'info');
      runEngine();
      engineRef.current = setInterval(runEngine, 60000);
    }
  };

  useEffect(() => () => clearInterval(engineRef.current), []);

  const addRule = () => {
    const trigger = TRIGGER_TYPES.find(t => t.value === ruleTrigger);
    const action = ACTION_TYPES.find(a => a.value === ruleAction);
    setRules(prev => [...prev, {
      id: Date.now(), adId: ruleAd, type: ruleTrigger,
      threshold: ruleThreshold, action: ruleAction, actionValue: ruleActionVal,
      label: `If ${trigger?.label} ${ruleThreshold}${trigger?.unit}, ${action?.label} ${ruleActionVal}${action?.unit}`,
      active: true,
    }]);
    setShowRuleForm(false);
    addLog('New trigger rule added.', 'info');
  };

  const addSchedule = () => {
    const preset = SCHEDULE_PRESETS[schedPreset];
    setSchedules(prev => [...prev, {
      id: Date.now(), adId: schedAd,
      label: preset.label, days: preset.days, hours: preset.hours,
      action: preset.action, value: preset.value, active: true,
    }]);
    setShowScheduleForm(false);
    addLog(`Schedule "${preset.label}" added.`, 'info');
  };

  const toggleRule = (id) => setRules(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));
  const deleteRule = (id) => setRules(prev => prev.filter(r => r.id !== id));
  const toggleSched = (id) => setSchedules(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
  const deleteSched = (id) => setSchedules(prev => prev.filter(s => s.id !== id));

  const logColor = { info: 'text-gray-400', success: 'text-green-400', warn: 'text-yellow-400', error: 'text-red-400' };

  return (
    <div className="space-y-5">
      {/* Engine control */}
      <div className={`border rounded-2xl p-4 flex items-center justify-between ${engineRunning ? 'bg-green-500/5 border-green-500/30' : 'bg-gray-900 border-gray-700'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${engineRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
          <div>
            <p className="text-white font-bold text-sm">{engineRunning ? 'Engine Running' : 'Engine Stopped'}</p>
            <p className="text-gray-500 text-xs">{rules.length} trigger rule(s) · {schedules.length} schedule(s)</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={runEngine} variant="outline" className="border-gray-600 text-gray-300 text-xs h-8 gap-1">
            <Zap className="w-3.5 h-3.5" /> Run Now
          </Button>
          <Button onClick={toggleEngine}
            className={`text-xs h-8 gap-1 font-bold ${engineRunning ? 'bg-red-700 hover:bg-red-600' : 'bg-green-600 hover:bg-green-500'} text-white`}>
            {engineRunning ? <><Pause className="w-3.5 h-3.5" /> Stop</> : <><Play className="w-3.5 h-3.5" /> Start Auto</>}
          </Button>
        </div>
      </div>

      {/* Trigger rules section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Trigger Rules</p>
          <Button size="sm" onClick={() => setShowRuleForm(s => !s)}
            className="bg-orange-600 hover:bg-orange-500 text-white text-xs h-7 px-2 gap-1">
            <Plus className="w-3.5 h-3.5" /> Add Rule
          </Button>
        </div>

        {showRuleForm && (
          <div className="bg-gray-900 border border-orange-500/30 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-orange-400 uppercase tracking-wider">New Trigger Rule</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 font-bold block mb-1">Apply to Ad</label>
                <select value={ruleAd} onChange={e => setRuleAd(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm">
                  <option value="all">All Ads</option>
                  {ads.map(a => <option key={a.id} value={a.id}>{a.brand_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-bold block mb-1">Trigger Condition</label>
                <select value={ruleTrigger} onChange={e => setRuleTrigger(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm">
                  {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-bold block mb-1">
                  Threshold ({TRIGGER_TYPES.find(t => t.value === ruleTrigger)?.unit})
                </label>
                <input type="number" step="0.1" value={ruleThreshold} onChange={e => setRuleThreshold(parseFloat(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-bold block mb-1">Then Action</label>
                <select value={ruleAction} onChange={e => setRuleAction(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm">
                  {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              {ruleAction !== 'pause_ad' && (
                <div>
                  <label className="text-xs text-gray-400 font-bold block mb-1">
                    Action Value ({ACTION_TYPES.find(a => a.value === ruleAction)?.unit})
                  </label>
                  <input type="number" step="0.5" value={ruleActionVal} onChange={e => setRuleActionVal(parseFloat(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm" />
                </div>
              )}
            </div>
            <Button onClick={addRule} className="bg-orange-600 hover:bg-orange-500 text-white font-bold gap-1">
              <Plus className="w-4 h-4" /> Add Rule
            </Button>
          </div>
        )}

        {rules.length === 0 && !showRuleForm && (
          <p className="text-gray-600 text-sm text-center py-4">No trigger rules yet. Add one above.</p>
        )}
        {rules.map(rule => (
          <div key={rule.id} className={`bg-gray-900 border rounded-xl p-3 flex items-center justify-between gap-3 ${rule.active ? 'border-orange-500/20' : 'border-gray-700 opacity-60'}`}>
            <div className="flex items-center gap-2 min-w-0">
              <Zap className={`w-4 h-4 flex-shrink-0 ${rule.active ? 'text-orange-400' : 'text-gray-600'}`} />
              <p className="text-gray-300 text-xs truncate">{rule.label}</p>
              {rule.adId !== 'all' && <Badge className="bg-gray-700 text-gray-400 text-[10px] flex-shrink-0">{ads.find(a => a.id === rule.adId)?.brand_name || 'Ad'}</Badge>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => toggleRule(rule.id)} className="text-gray-500 hover:text-white">
                {rule.active ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4" />}
              </button>
              <button onClick={() => deleteRule(rule.id)} className="text-gray-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Schedules section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Time-Based Schedules</p>
          <Button size="sm" onClick={() => setShowScheduleForm(s => !s)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-7 px-2 gap-1">
            <Plus className="w-3.5 h-3.5" /> Add Schedule
          </Button>
        </div>

        {showScheduleForm && (
          <div className="bg-gray-900 border border-blue-500/30 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">New Time Schedule</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 font-bold block mb-1">Apply to Ad</label>
                <select value={schedAd} onChange={e => setSchedAd(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm">
                  <option value="all">All Ads</option>
                  {ads.map(a => <option key={a.id} value={a.id}>{a.brand_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-bold block mb-1">Schedule Preset</label>
                <select value={schedPreset} onChange={e => setSchedPreset(parseInt(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm">
                  {SCHEDULE_PRESETS.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <Button onClick={addSchedule} className="bg-blue-600 hover:bg-blue-500 text-white font-bold gap-1">
              <Plus className="w-4 h-4" /> Add Schedule
            </Button>
          </div>
        )}

        {schedules.length === 0 && !showScheduleForm && (
          <p className="text-gray-600 text-sm text-center py-4">No schedules yet. Add one above.</p>
        )}
        {schedules.map(sched => (
          <div key={sched.id} className={`bg-gray-900 border rounded-xl p-3 flex items-center justify-between gap-3 ${sched.active ? 'border-blue-500/20' : 'border-gray-700 opacity-60'}`}>
            <div className="flex items-center gap-2 min-w-0">
              <Clock className={`w-4 h-4 flex-shrink-0 ${sched.active ? 'text-blue-400' : 'text-gray-600'}`} />
              <p className="text-gray-300 text-xs truncate">{sched.label}</p>
              {sched.adId !== 'all' && <Badge className="bg-gray-700 text-gray-400 text-[10px] flex-shrink-0">{ads.find(a => a.id === sched.adId)?.brand_name || 'Ad'}</Badge>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => toggleSched(sched.id)} className="text-gray-500 hover:text-white">
                {sched.active ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4" />}
              </button>
              <button onClick={() => deleteSched(sched.id)} className="text-gray-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Activity log */}
      {log.length > 0 && (
        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">Engine Activity Log</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {log.map((entry, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="text-gray-600 flex-shrink-0 font-mono">{entry.time}</span>
                <span className={logColor[entry.type]}>{entry.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}