// Shared store sort options + logic (Amazon-style set), used by the Physical and Digital stores so the
// sort control at the top of the results is consistent. Uses whatever listing fields are available with
// graceful fallbacks (missing fields sort as 0 / stable), so it works before ratings/sales data exists.

export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Featured' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Avg. Customer Review' },
  { value: 'newest', label: 'Newest Arrivals' },
  { value: 'bestsellers', label: 'Best Sellers' },
];

const num = (x) => Number(x) || 0;
const rating = (l) => num(l.rating ?? l.avg_rating ?? l.stars);
const sold = (l) => num(l.sold_count ?? l.purchases ?? l.sales ?? l.order_count);
const when = (l) => String(l.created_at ?? l.created_date ?? '');

export function applySort(listings, sort) {
  const arr = [...(listings || [])];
  switch (sort) {
    case 'price_asc': return arr.sort((a, b) => num(a.price_usd) - num(b.price_usd));
    case 'price_desc': return arr.sort((a, b) => num(b.price_usd) - num(a.price_usd));
    case 'rating': return arr.sort((a, b) => rating(b) - rating(a));
    case 'newest': return arr.sort((a, b) => when(b).localeCompare(when(a)));
    case 'bestsellers': return arr.sort((a, b) => sold(b) - sold(a));
    default: return arr; // 'relevance' / Featured — keep the source order
  }
}
