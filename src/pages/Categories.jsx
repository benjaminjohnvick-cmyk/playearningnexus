import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, ExternalLink, ChevronLeft, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';

// Categories — hierarchical browse: top categories → subcategories → "find the real thing" product
// search. Clicking a top category searches across ALL its subcategories (broad); picking a subcategory
// runs the specific product search. Category tiles use AI-generated images (serverless GPU) when present.
export default function Categories() {
  const [loading, setLoading] = useState(true);
  const [cats, setCats] = useState([]);
  const [counts, setCounts] = useState(null);
  const [active, setActive] = useState(null);        // { name, subcategories:[{name,nodes:[]}], image_url }
  const [activeSub, setActiveSub] = useState(null);  // a selected subcategory { name, nodes:[] }
  const [activeLoading, setActiveLoading] = useState(false);
  const [search, setSearch] = useState({ open: false, query: '', engines: [], loading: false, disclosure: '' });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await base44.functions.invoke('getTaxonomy', {});
        setCats(res.data?.categories || []);
        setCounts(res.data?.counts || null);
      } catch (e) { toast.error(e?.data?.error || 'Could not load categories'); }
      finally { setLoading(false); }
    })();
  }, []);

  async function openCategory(name) {
    setActiveLoading(true);
    setActiveSub(null);
    setActive({ name, subcategories: [], image_url: null });
    try {
      const res = await base44.functions.invoke('getTaxonomy', { category: name });
      setActive({ name, subcategories: res.data?.subcategories || [], image_url: res.data?.image_url || null, browse_node_count: res.data?.browse_node_count || 0 });
    } catch (e) { toast.error(e?.data?.error || 'Could not load subcategories'); }
    finally { setActiveLoading(false); }
  }

  async function runSearch(query) {
    setSearch({ open: true, query, engines: [], loading: true, disclosure: '' });
    try {
      const res = await base44.functions.invoke('marketplaceSearchLink', { query });
      setSearch((s) => ({ ...s, engines: res.data?.engines || [], disclosure: res.data?.disclosure || '', loading: false }));
    } catch (e) { toast.error(e?.data?.error || 'Search failed'); setSearch((s) => ({ ...s, loading: false })); }
  }

  const tile = (name) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <LayoutGrid className="w-6 h-6" /><h1 className="text-2xl font-bold">Shop by Category</h1>
      </div>
      {counts && (
        <p className="text-sm text-zinc-500 mb-4">{counts.categories} departments · {counts.subcategories.toLocaleString()} subcategories · up to {(counts.browse_node_target || 0).toLocaleString()} browse nodes — pick a category, then find the real product.</p>
      )}

      {loading ? (
        <div className="p-8 flex items-center gap-2 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading categories…</div>
      ) : !active ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {cats.map((c) => (
            <Card key={c.name} className="overflow-hidden cursor-pointer hover:shadow-md transition" onClick={() => openCategory(c.name)}>
              <div className="h-28 bg-zinc-100 flex items-center justify-center">
                {c.image_url ? <img src={c.image_url} alt={c.name} className="w-full h-28 object-cover" />
                  : <span className="text-2xl font-bold text-zinc-400">{tile(c.name)}</span>}
              </div>
              <CardContent className="p-2">
                <div className="text-sm font-medium truncate">{c.name}</div>
                <div className="text-[11px] text-zinc-400">{c.subcategory_count} subcategories</div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div>
          {!activeSub ? (
            <>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => setActive(null)}><ChevronLeft className="w-4 h-4 mr-1" /> All categories</Button>
                <Button size="sm" onClick={() => runSearch(active.name)}>
                  <Search className="w-4 h-4 mr-1" /> Find the real thing across all of {active.name}
                </Button>
              </div>
              <h2 className="text-lg font-semibold mb-2">{active.name}</h2>
              {activeLoading ? (
                <div className="p-4 flex items-center gap-2 text-zinc-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {active.subcategories.map((s) => (
                    <button key={s.name}
                      onClick={() => (s.nodes && s.nodes.length ? setActiveSub(s) : runSearch(s.name))}
                      className="px-3 py-1.5 rounded-full border text-sm hover:bg-red-50 hover:border-red-300 transition">
                      {s.name}{s.nodes && s.nodes.length ? <span className="text-zinc-400 ml-1">({s.nodes.length})</span> : null}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => setActiveSub(null)}><ChevronLeft className="w-4 h-4 mr-1" /> {active.name}</Button>
                <Button size="sm" onClick={() => runSearch(activeSub.name)}>
                  <Search className="w-4 h-4 mr-1" /> Find the real thing across all {activeSub.name}
                </Button>
              </div>
              <h2 className="text-lg font-semibold mb-2">{activeSub.name}</h2>
              <div className="flex flex-wrap gap-2">
                {activeSub.nodes.map((n) => (
                  <button key={n} onClick={() => runSearch(n)}
                    className="px-3 py-1.5 rounded-full border text-sm hover:bg-red-50 hover:border-red-300 transition">
                    {n}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Product search results (real listings from across the web). */}
      {search.open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSearch((s) => ({ ...s, open: false }))} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSearch((s) => ({ ...s, open: false })); } }}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="font-semibold flex items-center gap-2"><Search className="w-4 h-4" /> {search.query}</div>
                <button className="text-zinc-400 text-xl leading-none" onClick={() => setSearch((s) => ({ ...s, open: false }))}>×</button>
              </div>
              <div className="text-xs text-zinc-500 mb-3">Real listings from across the web:</div>
              {search.loading ? (
                <div className="py-4 flex items-center gap-2 text-zinc-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Building results…</div>
              ) : (
                <div className="space-y-2">
                  {search.engines.map((e) => (
                    <Button key={e.key} variant="outline" className="w-full justify-between" onClick={() => window.open(e.url, '_blank', 'noopener,noreferrer')}>
                      <span className="flex items-center gap-2"><ExternalLink className="w-4 h-4" /> {e.label}</span>
                      {e.affiliate ? <Badge className="bg-amber-600 text-white text-[10px]">affiliate</Badge> : null}
                    </Button>
                  ))}
                  {search.disclosure ? <div className="text-[11px] text-zinc-400 pt-1">{search.disclosure}</div> : null}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
