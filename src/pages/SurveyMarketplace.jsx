import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Store, Plus, Tag, MapPin, Cpu, Users, DollarSign, Loader2, Search, ArrowLeftRight, Star, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const INTEREST_TAGS = ['Tech','Finance','Health','Gaming','Travel','Food','Fashion','Sports','Music','Education','Parenting','Environment','Business','Entertainment'];
const GEO_TAGS = ['USA','Canada','UK','Europe','Asia','Latin America','Australia','Africa','Middle East'];
const ALL_TAGS = [...INTEREST_TAGS, ...GEO_TAGS];

const TIER_ORDER = ['bronze','silver','gold','platinum','diamond'];
const LISTING_COLORS = { trade: 'bg-blue-100 text-blue-700', micro_survey: 'bg-purple-100 text-purple-700', swap: 'bg-teal-100 text-teal-700' };

function ListingCard({ listing, userTags, onRespond }) {
  const tagMatch = listing.required_tags?.filter(t => userTags.includes(t)) || [];
  const meetsRequirements = listing.required_tags?.length === 0 || tagMatch.length > 0;

  return (
    <Card className={`hover:shadow-md transition-shadow border-2 ${meetsRequirements ? 'border-transparent' : 'border-gray-100 opacity-70'}`}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge className={`text-xs ${LISTING_COLORS[listing.listing_type] || 'bg-gray-100 text-gray-700'}`}>
                {listing.listing_type === 'micro_survey' ? '📋 Micro-Survey' : listing.listing_type === 'trade' ? '🔄 Trade' : '↔️ Swap'}
              </Badge>
              {listing.creator_prestige_tier && (
                <Badge variant="outline" className="text-xs capitalize">
                  {listing.creator_prestige_tier === 'diamond' ? '💎' : listing.creator_prestige_tier === 'platinum' ? '💜' : listing.creator_prestige_tier === 'gold' ? '🥇' : '⭐'} {listing.creator_prestige_tier}
                </Badge>
              )}
            </div>
            <h3 className="font-semibold text-gray-900 text-sm">{listing.title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{listing.creator_name}</p>
          </div>
          {listing.reward_amount > 0 && (
            <div className="text-right flex-shrink-0">
              <p className="text-lg font-black text-green-600">${listing.reward_amount.toFixed(2)}</p>
              <p className="text-xs text-gray-400">reward</p>
            </div>
          )}
        </div>

        {listing.description && <p className="text-xs text-gray-600 mb-3 line-clamp-2">{listing.description}</p>}

        {listing.swap_offer && (
          <div className="bg-blue-50 rounded-lg px-3 py-1.5 mb-3 flex items-center gap-2">
            <ArrowLeftRight className="w-3 h-3 text-blue-500 flex-shrink-0" />
            <p className="text-xs text-blue-700">Offering: {listing.swap_offer}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-1 mb-3">
          {(listing.required_tags || []).map(t => (
            <span key={t} className={`text-xs px-2 py-0.5 rounded-full border ${userTags.includes(t) ? 'bg-green-100 text-green-700 border-green-300' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
              {userTags.includes(t) ? '✓ ' : ''}{t}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">{listing.responses_count || 0}/{listing.max_responses} responses</p>
          {meetsRequirements ? (
            <Button size="sm" onClick={() => onRespond(listing)} className="text-xs h-7">
              {listing.listing_type === 'micro_survey' ? 'Take Survey' : listing.listing_type === 'trade' ? 'Make Trade' : 'Swap'}
            </Button>
          ) : (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Lock className="w-3 h-3" /> Need matching tags
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateListingForm({ user, prestige, onCreated, onCancel }) {
  const canCreateMicroSurvey = prestige?.prestige_score >= 400; // Gold+
  const [form, setForm] = useState({
    title: '', description: '', listing_type: 'trade', swap_offer: '',
    reward_amount: 0, required_tags: [], max_responses: 50,
    questions: [{ question: '', type: 'multiple_choice', options: ['Yes','No'] }],
  });
  const [saving, setSaving] = useState(false);

  const toggleTag = (tag) => setForm(f => ({
    ...f,
    required_tags: f.required_tags.includes(tag) ? f.required_tags.filter(t => t !== tag) : [...f.required_tags, tag]
  }));

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setQ = (i, k, v) => setForm(f => {
    const qs = [...f.questions];
    qs[i] = { ...qs[i], [k]: v };
    return { ...f, questions: qs };
  });

  const handleSave = async (status = 'active') => {
    if (!form.title) return toast.error('Title required');
    setSaving(true);
    try {
      await base44.entities.SurveyMarketplaceListing.create({
        ...form,
        creator_user_id: user.id,
        creator_name: user.full_name,
        creator_prestige_tier: prestige?.prestige_tier || 'bronze',
        status,
        responses_count: 0,
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      });
      toast.success('Listing created!');
      onCreated();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  return (
    <Card className="border-2 border-dashed border-purple-300 bg-purple-50/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4" /> New Listing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">Title</label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="What are you offering?" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Type</label>
            <Select value={form.listing_type} onValueChange={v => set('listing_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trade">🔄 Trade Survey Opportunity</SelectItem>
                <SelectItem value="swap">↔️ Swap</SelectItem>
                {canCreateMicroSurvey
                  ? <SelectItem value="micro_survey">📋 Micro-Survey (Gold+ only)</SelectItem>
                  : <SelectItem value="micro_survey" disabled>📋 Micro-Survey (requires Gold prestige)</SelectItem>
                }
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium block mb-1">Description</label>
          <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe your listing…" className="h-20 text-sm" />
        </div>

        {form.listing_type === 'swap' && (
          <div>
            <label className="text-xs font-medium block mb-1">What you're offering in exchange</label>
            <Input value={form.swap_offer} onChange={e => set('swap_offer', e.target.value)} placeholder="e.g. Priority access to my Tech survey" />
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">Reward ($)</label>
            <Input type="number" min="0" step="0.25" value={form.reward_amount} onChange={e => set('reward_amount', Number(e.target.value))} className="h-9" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Max responses</label>
            <Input type="number" min="1" value={form.max_responses} onChange={e => set('max_responses', Number(e.target.value))} className="h-9" />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium block mb-2">Required respondent tags <span className="text-gray-400">(leave empty for all)</span></label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_TAGS.map(t => (
              <button key={t} onClick={() => toggleTag(t)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${form.required_tags.includes(t) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {form.listing_type === 'micro_survey' && canCreateMicroSurvey && (
          <div>
            <label className="text-xs font-medium block mb-2">Questions</label>
            {form.questions.map((q, i) => (
              <div key={i} className="mb-3 p-3 bg-white rounded-xl border">
                <Input value={q.question} onChange={e => setQ(i, 'question', e.target.value)} placeholder={`Question ${i + 1}`} className="mb-2 text-sm" />
                <Select value={q.type} onValueChange={v => setQ(i, 'type', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="rating">Rating</SelectItem>
                    <SelectItem value="text">Open Text</SelectItem>
                    <SelectItem value="yes_no">Yes/No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => set('questions', [...form.questions, { question: '', type: 'multiple_choice', options: ['Yes','No'] }])}>
              + Add Question
            </Button>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button onClick={() => handleSave('active')} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />} Publish
          </Button>
          <Button onClick={() => handleSave('draft')} disabled={saving} variant="outline">Save Draft</Button>
          <Button onClick={onCancel} variant="ghost">Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SurveyMarketplace() {
  const [user, setUser] = useState(null);
  const [prestige, setPrestige] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterTag, setFilterTag] = useState('all');
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(async u => {
      setUser(u);
      const p = await base44.entities.GlobalPrestige.filter({ user_id: u.id });
      setPrestige(p[0] || null);
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const userTags = user?.survey_interests || [];

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['survey_marketplace', filterType, filterTag, search],
    queryFn: async () => {
      const all = await base44.entities.SurveyMarketplaceListing.filter({ status: 'active' }, '-created_date', 100);
      return all.filter(l => {
        if (filterType !== 'all' && l.listing_type !== filterType) return false;
        if (filterTag !== 'all' && !l.required_tags?.includes(filterTag) && !l.tags?.includes(filterTag)) return false;
        if (search && !l.title.toLowerCase().includes(search.toLowerCase()) && !l.description?.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      });
    },
    enabled: !!user,
  });

  const { data: myListings = [] } = useQuery({
    queryKey: ['my_listings', user?.id],
    queryFn: () => base44.entities.SurveyMarketplaceListing.filter({ creator_user_id: user.id }, '-created_date', 50),
    enabled: !!user,
  });

  const handleRespond = (listing) => {
    toast.success(`Responding to: ${listing.title}`, { description: 'Feature coming soon — full response flow launching!' });
  };

  const handleToggleListing = async (listing) => {
    const newStatus = listing.status === 'active' ? 'paused' : 'active';
    await base44.entities.SurveyMarketplaceListing.update(listing.id, { status: newStatus });
    toast.success(`Listing ${newStatus}`);
    qc.invalidateQueries({ queryKey: ['my_listings'] });
  };

  if (!user) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>;

  const canCreate = (prestige?.prestige_score || 0) >= 200; // Silver+

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <Store className="w-6 h-6 text-purple-600" /> Survey Marketplace
            </h1>
            <p className="text-sm text-gray-500">Trade, swap, and create survey opportunities based on your profile</p>
          </div>
          {canCreate ? (
            <Button onClick={() => setShowCreate(true)} className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-1" /> Create Listing
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-xl">
              <Lock className="w-4 h-4" /> Reach Silver prestige to list
            </div>
          )}
        </div>

        {/* User tags */}
        {userTags.length > 0 && (
          <Card className="border-purple-200 bg-purple-50/30">
            <CardContent className="pt-3 pb-3">
              <p className="text-xs font-semibold text-purple-700 mb-2">Your profile tags (used for matching):</p>
              <div className="flex flex-wrap gap-1.5">
                {userTags.map(t => (
                  <span key={t} className="text-xs bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {showCreate && (
          <CreateListingForm user={user} prestige={prestige}
            onCreated={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['survey_marketplace'] }); qc.invalidateQueries({ queryKey: ['my_listings'] }); }}
            onCancel={() => setShowCreate(false)}
          />
        )}

        <Tabs defaultValue="browse">
          <TabsList>
            <TabsTrigger value="browse">Browse ({listings.length})</TabsTrigger>
            <TabsTrigger value="mine">My Listings ({myListings.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-4 mt-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search listings…" className="pl-9 h-9" />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="micro_survey">Micro-Surveys</SelectItem>
                  <SelectItem value="trade">Trades</SelectItem>
                  <SelectItem value="swap">Swaps</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterTag} onValueChange={setFilterTag}>
                <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Tag" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {ALL_TAGS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-gray-300" /></div>
            ) : listings.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-gray-400">
                  <Store className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No listings yet — be the first to create one!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {listings.map(l => <ListingCard key={l.id} listing={l} userTags={userTags} onRespond={handleRespond} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="mine" className="mt-4">
            {myListings.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-gray-400">
                  <p>You haven't created any listings yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {myListings.map(l => (
                  <Card key={l.id} className="border">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{l.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={`text-xs ${LISTING_COLORS[l.listing_type]}`}>{l.listing_type}</Badge>
                            <Badge variant={l.status === 'active' ? 'default' : 'secondary'} className="text-xs">{l.status}</Badge>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{l.responses_count}/{l.max_responses} responses · expires {l.expires_at ? format(new Date(l.expires_at), 'MMM d') : '—'}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleToggleListing(l)} className="text-xs">
                          {l.status === 'active' ? 'Pause' : 'Resume'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}