import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronRight, X, Star } from 'lucide-react';

// AppStoreBrowse — the App Store's categories + subsections (with serverless-GPU tiles) and a search
// bar for any app or game. Self-contained: it reads the backend appStoreCategories + appStoreSearch
// functions and renders on its own, so it can drop into the Store page without touching the rest.
export default function AppStoreBrowse() {
  const [categories, setCategories] = useState([]);
  const [openCat, setOpenCat] = useState(null);          // expanded category (shows subsections)
  const [query, setQuery] = useState('');
  const [activeSub, setActiveSub] = useState(null);       // { category, subcategory } filter
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    base44.functions.invoke('appStoreCategories', {})
      .then((r) => setCategories(r.data?.categories || []))
      .catch(() => setCategories([]));
  }, []);

  async function runSearch(opts = {}) {
    const body = {
      query: opts.query !== undefined ? opts.query : query,
      category: opts.category ?? activeSub?.category ?? null,
      subcategory: opts.subcategory ?? activeSub?.subcategory ?? null,
    };
    if (!body.query && !body.category && !body.subcategory) { setResults(null); return; }
    setLoading(true);
    try {
      const r = await base44.functions.invoke('appStoreSearch', body);
      setResults(r.data || { results: [] });
    } catch { setResults({ results: [] }); }
    setLoading(false);
  }

  function clearSearch() { setQuery(''); setActiveSub(null); setResults(null); }

  return (
    <div className="mb-8">
      {/* Search bar — any app or game */}
      <div className="flex items-center gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
            placeholder="Search any app or game…"
            className="pl-9"
          />
        </div>
        <Button className="bg-red-600 hover:bg-red-700" onClick={() => runSearch()}>Search</Button>
        {(results || activeSub) && (
          <Button variant="outline" onClick={clearSearch}><X className="w-4 h-4 mr-1" /> Clear</Button>
        )}
      </div>

      {/* Results (when searching / filtering) */}
      {results ? (
        <div>
          <p className="text-sm text-gray-500 mb-3">
            {loading ? 'Searching…' : `${results.total ?? results.results?.length ?? 0} result(s)`}
            {activeSub?.subcategory ? ` in ${activeSub.subcategory}` : activeSub?.category ? ` in ${activeSub.category}` : ''}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {(results.results || []).map((r) => (
              <Card key={`${r.kind}-${r.id}`} className="border-0 shadow hover:shadow-lg transition-all">
                <div className="h-28 bg-gradient-to-br from-red-400 to-rose-600 rounded-t-xl overflow-hidden">
                  {r.image_url && <img src={r.image_url} alt={r.title} className="w-full h-full object-cover" />}
                </div>
                <CardContent className="p-3">
                  <p className="font-semibold text-sm text-gray-900 line-clamp-1">{r.title}</p>
                  <p className="text-xs text-gray-500 line-clamp-1">{r.developer || r.category}</p>
                  <div className="flex items-center justify-between mt-1">
                    <Badge variant="outline" className="text-[10px]">{r.kind === 'game' ? 'Game' : 'App'}</Badge>
                    {r.rating != null && <span className="text-[11px] text-amber-600 flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{r.rating}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        /* Category browse — sections + subsections with GPU tiles */
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {categories.map((c) => (
              <button
                key={c.name}
                onClick={() => setOpenCat(openCat === c.name ? null : c.name)}
                className={`text-left rounded-xl overflow-hidden border transition-all ${openCat === c.name ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-200 hover:border-red-300'}`}
              >
                <div className="h-20 bg-gradient-to-br from-red-400 to-rose-500 overflow-hidden">
                  {c.image_url && <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />}
                </div>
                <div className="px-2 py-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-800 line-clamp-1">{c.name}</span>
                  <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openCat === c.name ? 'rotate-90' : ''}`} />
                </div>
              </button>
            ))}
          </div>

          {/* Subsections of the expanded category */}
          {openCat && (
            <div className="mt-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-3">{openCat} — subsections</p>
              <div className="flex flex-wrap gap-2">
                {(categories.find((c) => c.name === openCat)?.subs || []).map((s) => (
                  <button
                    key={s.name}
                    onClick={() => { const f = { category: openCat, subcategory: s.name }; setActiveSub(f); runSearch(f); }}
                    className="px-3 py-1.5 rounded-full bg-white border border-gray-200 hover:border-red-400 hover:text-red-600 text-xs font-medium text-gray-700"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
