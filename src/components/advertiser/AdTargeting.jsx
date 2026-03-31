import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Globe, MapPin, Users, Zap, Loader2, CheckCircle, Info } from 'lucide-react';
import { toast } from 'sonner';

const COUNTRIES = [
  { code: 'US', name: 'United States' }, { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' }, { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' }, { code: 'FR', name: 'France' },
  { code: 'BR', name: 'Brazil' }, { code: 'MX', name: 'Mexico' },
  { code: 'IN', name: 'India' }, { code: 'JP', name: 'Japan' },
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
];

const AGE_BUCKETS = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+'];
const INTEREST_BUCKETS = ['gaming', 'sports', 'tech', 'fashion', 'finance', 'health', 'music', 'travel', 'food', 'education'];

function ToggleChip({ label, selected, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
        selected
          ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
      }`}
    >
      {selected && <span className="mr-1">✓</span>}
      {label}
    </button>
  );
}

export default function AdTargeting({ ads }) {
  const [selectedAdId, setSelectedAdId] = useState(ads[0]?.id || '');
  const [rule, setRule] = useState({ countries: [], us_states: [], age_buckets: [], interest_buckets: [] });
  const [existingRuleId, setExistingRuleId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!selectedAdId) return;
    setFetching(true);
    base44.entities.AdTargetingRule.filter({ ad_id: selectedAdId }).then(rules => {
      if (rules.length > 0) {
        const r = rules[0];
        setExistingRuleId(r.id);
        setRule({
          countries: r.countries || [],
          us_states: r.us_states || [],
          age_buckets: r.age_buckets || [],
          interest_buckets: r.interest_buckets || [],
        });
      } else {
        setExistingRuleId(null);
        setRule({ countries: [], us_states: [], age_buckets: [], interest_buckets: [] });
      }
      setFetching(false);
    });
  }, [selectedAdId]);

  const toggle = (field, value) => {
    setRule(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value],
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    const ad = ads.find(a => a.id === selectedAdId);
    const payload = { ad_id: selectedAdId, owner_user_id: ad?.owner_user_id, ...rule, is_active: true };
    if (existingRuleId) {
      await base44.entities.AdTargetingRule.update(existingRuleId, rule);
    } else {
      const created = await base44.entities.AdTargetingRule.create(payload);
      setExistingRuleId(created.id);
    }
    toast.success('Targeting rules saved');
    setLoading(false);
  };

  const isTargeted = rule.countries.length > 0 || rule.us_states.length > 0 ||
    rule.age_buckets.length > 0 || rule.interest_buckets.length > 0;

  if (ads.length === 0) {
    return <div className="text-center py-10 text-gray-500 text-sm">Submit an ad first to configure targeting.</div>;
  }

  return (
    <div className="space-y-5">
      {/* Ad selector */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Select Campaign</p>
        <div className="flex flex-wrap gap-2">
          {ads.map(ad => (
            <button
              key={ad.id}
              onClick={() => setSelectedAdId(ad.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                selectedAdId === ad.id
                  ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              {ad.brand_name}
              {selectedAdId === ad.id && isTargeted && (
                <Badge className="bg-yellow-500 text-black text-[9px] px-1 py-0">targeted</Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      {fetching ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading rules...
        </div>
      ) : (
        <>
          {/* Info */}
          <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Leaving a section empty means <strong>no filter</strong> — all users see the ad. Select specific values to narrow visibility.
          </div>

          {/* Countries */}
          <div>
            <p className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1.5">
              <Globe className="w-3 h-3" /> Countries
              {rule.countries.length > 0 && <Badge className="bg-gray-700 text-gray-300 text-[10px]">{rule.countries.length} selected</Badge>}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {COUNTRIES.map(c => (
                <ToggleChip key={c.code} label={c.name} selected={rule.countries.includes(c.code)} onToggle={() => toggle('countries', c.code)} />
              ))}
            </div>
          </div>

          {/* US States — only shown when US is selected */}
          {rule.countries.includes('US') && (
            <div>
              <p className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1.5">
                <MapPin className="w-3 h-3" /> US States
                {rule.us_states.length > 0 && <Badge className="bg-gray-700 text-gray-300 text-[10px]">{rule.us_states.length} selected</Badge>}
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {US_STATES.map(s => (
                  <ToggleChip key={s} label={s} selected={rule.us_states.includes(s)} onToggle={() => toggle('us_states', s)} />
                ))}
              </div>
            </div>
          )}

          {/* Age buckets */}
          <div>
            <p className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1.5">
              <Users className="w-3 h-3" /> Age Groups
            </p>
            <div className="flex flex-wrap gap-1.5">
              {AGE_BUCKETS.map(a => (
                <ToggleChip key={a} label={a} selected={rule.age_buckets.includes(a)} onToggle={() => toggle('age_buckets', a)} />
              ))}
            </div>
          </div>

          {/* Interests */}
          <div>
            <p className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1.5">
              <Zap className="w-3 h-3" /> Interest Categories
            </p>
            <div className="flex flex-wrap gap-1.5">
              {INTEREST_BUCKETS.map(i => (
                <ToggleChip key={i} label={i} selected={rule.interest_buckets.includes(i)} onToggle={() => toggle('interest_buckets', i)} />
              ))}
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={loading}
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-black gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Save Targeting Rules
          </Button>
        </>
      )}
    </div>
  );
}