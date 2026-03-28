import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, RefreshCw, Loader2, Edit2, Check, X, TrendingUp, Users, Star } from 'lucide-react';
import { toast } from 'sonner';

const TIER_COLORS = {
  bronze: 'bg-amber-100 text-amber-700 border-amber-300',
  silver: 'bg-gray-100 text-gray-600 border-gray-300',
  gold: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  platinum: 'bg-purple-100 text-purple-700 border-purple-300'
};

const TIER_THRESHOLDS = {
  bronze:   { installs: 0,    completion: 0,  rate: 30 },
  silver:   { installs: 500,  completion: 60, rate: 40 },
  gold:     { installs: 2000, completion: 75, rate: 50 },
  platinum: { installs: 5000, completion: 85, rate: 60 }
};

function PartnerRow({ record, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [overrideRate, setOverrideRate] = useState(record.admin_override_rate || record.commission_rate || 30);
  const [overrideTier, setOverrideTier] = useState(record.tier || 'bronze');
  const [notes, setNotes] = useState(record.admin_override_notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.PartnerTier.update(record.id, {
      admin_override: true,
      admin_override_rate: Number(overrideRate),
      commission_rate: Number(overrideRate),
      tier: overrideTier,
      admin_override_notes: notes
    });
    toast.success('Override saved');
    setSaving(false);
    setEditing(false);
    onUpdate();
  };

  const handleClearOverride = async () => {
    await base44.entities.PartnerTier.update(record.id, {
      admin_override: false,
      commission_rate: record.ai_suggested_rate || 30,
      tier: record.ai_suggested_tier || 'bronze',
      admin_override_notes: ''
    });
    toast.success('Override cleared — AI rate restored');
    onUpdate();
  };

  return (
    <Card className={`border-2 ${record.admin_override ? 'border-blue-300 bg-blue-50/30' : 'border-gray-100'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-gray-900">{record.company_name || record.partner_id?.slice(0,12)}</p>
              {record.admin_override && <Badge variant="outline" className="text-xs border-blue-400 text-blue-600">Admin Override</Badge>}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge className={`border text-xs ${TIER_COLORS[record.tier]}`}>{record.tier?.toUpperCase()}</Badge>
              <span className="text-xs text-gray-500">📦 {record.install_volume_30d?.toLocaleString()} installs/30d</span>
              <span className="text-xs text-gray-500">✅ {record.survey_completion_rate_30d?.toFixed(1)}% completion</span>
            </div>
            {record.ai_rationale && (
              <p className="text-xs text-gray-500 mt-2 italic">AI: {record.ai_rationale}</p>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{record.commission_rate}%</p>
              <p className="text-xs text-gray-400">Commission</p>
              {record.ai_suggested_rate && record.ai_suggested_rate !== record.commission_rate && (
                <p className="text-xs text-purple-500">AI: {record.ai_suggested_rate}%</p>
              )}
            </div>
            <div className="flex gap-1.5">
              {!editing ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Override
                  </Button>
                  {record.admin_override && (
                    <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={handleClearOverride}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </>
              ) : (
                <div className="flex flex-col gap-2 min-w-[220px]">
                  <div className="flex gap-2">
                    <Select value={overrideTier} onValueChange={setOverrideTier}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['bronze','silver','gold','platinum'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" min="0" max="100" value={overrideRate}
                      onChange={e => setOverrideRate(e.target.value)}
                      className="h-8 w-20 text-xs" placeholder="Rate %" />
                  </div>
                  <Textarea placeholder="Override reason..." value={notes}
                    onChange={e => setNotes(e.target.value)} className="text-xs min-h-[50px]" />
                  <div className="flex gap-1.5">
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 flex-1" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />} Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PartnerTiersPanel() {
  const [running, setRunning] = useState(false);
  const qc = useQueryClient();

  const { data: records = [] } = useQuery({
    queryKey: ['partner_tiers'],
    queryFn: () => base44.entities.PartnerTier.list('-install_volume_30d', 50)
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['business_clients'],
    queryFn: () => base44.entities.BusinessClient.list()
  });

  const runAutoEvaluation = async () => {
    setRunning(true);
    try {
      let created = 0, updated = 0;
      for (const partner of partners) {
        const completionRate = Math.min(100, (partner.total_revenue || 0) / Math.max(1, partner.total_installs || 1) * 25);
        const installs = partner.total_installs || 0;

        let suggestedTier = 'bronze';
        let suggestedRate = 30;
        if (installs >= 5000 && completionRate >= 85) { suggestedTier = 'platinum'; suggestedRate = 60; }
        else if (installs >= 2000 && completionRate >= 75) { suggestedTier = 'gold'; suggestedRate = 50; }
        else if (installs >= 500 && completionRate >= 60) { suggestedTier = 'silver'; suggestedRate = 40; }

        const rationale = `${installs.toLocaleString()} installs, ${completionRate.toFixed(1)}% est. completion → qualifies for ${suggestedTier}`;
        const existing = records.find(r => r.partner_id === partner.id);

        if (existing) {
          if (!existing.admin_override) {
            await base44.entities.PartnerTier.update(existing.id, {
              install_volume_30d: installs,
              survey_completion_rate_30d: completionRate,
              ai_suggested_tier: suggestedTier,
              ai_suggested_rate: suggestedRate,
              tier: suggestedTier,
              commission_rate: suggestedRate,
              ai_rationale: rationale,
              last_evaluated_at: new Date().toISOString()
            });
          } else {
            await base44.entities.PartnerTier.update(existing.id, {
              install_volume_30d: installs,
              survey_completion_rate_30d: completionRate,
              ai_suggested_tier: suggestedTier,
              ai_suggested_rate: suggestedRate,
              ai_rationale: rationale,
              last_evaluated_at: new Date().toISOString()
            });
          }
          updated++;
        } else {
          await base44.entities.PartnerTier.create({
            partner_id: partner.id,
            company_name: partner.company_name,
            install_volume_30d: installs,
            survey_completion_rate_30d: completionRate,
            tier: suggestedTier,
            commission_rate: suggestedRate,
            ai_suggested_tier: suggestedTier,
            ai_suggested_rate: suggestedRate,
            ai_rationale: rationale,
            last_evaluated_at: new Date().toISOString()
          });
          created++;
        }
      }
      toast.success(`Evaluated ${partners.length} partners — ${created} created, ${updated} updated`);
      qc.invalidateQueries({ queryKey: ['partner_tiers'] });
    } catch (e) {
      toast.error('Evaluation failed: ' + e.message);
    } finally {
      setRunning(false);
    }
  };

  const tierCounts = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
  records.forEach(r => { if (tierCounts[r.tier] !== undefined) tierCounts[r.tier]++; });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Partner Commission Tiers</h3>
          <p className="text-sm text-gray-500">AI auto-adjusts rates by performance. Admins can override any partner.</p>
        </div>
        <Button onClick={runAutoEvaluation} disabled={running} className="bg-purple-600 hover:bg-purple-700">
          {running ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Brain className="w-4 h-4 mr-2" />}
          Run AI Evaluation
        </Button>
      </div>

      {/* Tier Summary */}
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(tierCounts).map(([tier, count]) => (
          <Card key={tier} className={`border ${TIER_COLORS[tier]}`}>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs capitalize">{tier}</p>
              <p className="text-xs opacity-70">{TIER_THRESHOLDS[tier].rate}% rate</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tier Thresholds Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-blue-800 mb-2">Automatic Tier Thresholds</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-blue-700">
            {Object.entries(TIER_THRESHOLDS).map(([tier, t]) => (
              <div key={tier} className="bg-white rounded p-2 capitalize">
                <strong>{tier}</strong>: {t.installs.toLocaleString()}+ installs, {t.completion}%+ completion → {t.rate}% commission
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Partner List */}
      <div className="space-y-3">
        {records.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No partner records yet — click "Run AI Evaluation" to evaluate all partners</p>
          </div>
        ) : (
          records.map(r => <PartnerRow key={r.id} record={r} onUpdate={() => qc.invalidateQueries({ queryKey: ['partner_tiers'] })} />)
        )}
      </div>
    </div>
  );
}