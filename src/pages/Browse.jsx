import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useMemo, useState, useEffect } from 'react';
import { SlidersHorizontal, Package } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ListingCard from '@/components/marketplace/ListingCard';
import EmptyState from '@/components/marketplace/EmptyState';
import { Button } from '@/components/ui/button';
import { fetchCategories, CONDITION_LABELS, SORT_OPTIONS } from '@/lib/marketplace';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR', 'BRL', 'ZAR', 'NGN', 'AED'];

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState({
    q: params.get('q') || '',
    category: params.get('category') || '',
    condition: params.get('condition') || '',
    currency: params.get('currency') || '',
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    sort: params.get('sort') || 'newest',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Sync URL params <-> filters
  useEffect(() => {
    const next = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) next[k] = v; });
    setParams(next, { replace: true });
     
  }, [filters]);

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['browse-listings'],
    queryFn: () => base44.entities.Listing.filter({ status: 'published' }, '-created_date', 120),
  });

  // Resolve category name from slug
  const categoryObj = useMemo(
    () => categories.find((c) => c.slug === filters.category),
    [categories, filters.category]
  );

  const filtered = useMemo(() => {
    let result = [...listings];
    const q = filters.q.trim().toLowerCase();
    if (q) {
      result = result.filter((l) =>
        [l.title, l.description, l.category, l.subcategory, ...(l.tags || [])]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(q))
      );
    }
    if (categoryObj) {
      result = result.filter((l) => l.category === categoryObj.name || l.category_id === categoryObj.id);
    }
    if (filters.condition) result = result.filter((l) => l.condition === filters.condition);
    if (filters.currency) result = result.filter((l) => (l.currency || 'USD') === filters.currency);
    if (filters.minPrice) result = result.filter((l) => Number(l.price) >= Number(filters.minPrice));
    if (filters.maxPrice) result = result.filter((l) => Number(l.price) <= Number(filters.maxPrice));

    switch (filters.sort) {
      case 'price_asc': result.sort((a, b) => Number(a.price) - Number(b.price)); break;
      case 'price_desc': result.sort((a, b) => Number(b.price) - Number(a.price)); break;
      default: result.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    }
    return result;
  }, [listings, filters, categoryObj]);

  // Sellers
  const sellerIds = Array.from(new Set(filtered.map((l) => l.seller_id || l.created_by_id).filter(Boolean)));
  const { data: sellers = [] } = useQuery({
    queryKey: ['sellers', sellerIds.join(',')],
    queryFn: () => Promise.all(sellerIds.map((id) => base44.entities.User.get(id).catch(() => null))),
    enabled: sellerIds.length > 0,
  });
  const sellerMap = {};
  sellers.forEach((s) => { if (s) sellerMap[s.id] = s; });

  const update = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearAll = () => setFilters({ q: '', category: '', condition: '', currency: '', minPrice: '', maxPrice: '', sort: 'newest' });

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => v && k !== 'sort' && k !== 'q').length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Browse the marketplace</h1>
        <p className="mt-1 text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'listing' : 'listings'} found</p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Filters sidebar */}
        <aside className={`${showFilters ? 'block' : 'hidden'} lg:block lg:w-64 lg:shrink-0`}>
          <div className="space-y-6 rounded-2xl border border-border/60 bg-card p-5 lg:sticky lg:top-20">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Filters</h2>
              {activeFilterCount > 0 && (
                <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground">Clear all</button>
              )}
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Category</label>
              <select value={filters.category} onChange={(e) => update('category', e.target.value)} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-ring">
                <option value="">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Condition</label>
              <select value={filters.condition} onChange={(e) => update('condition', e.target.value)} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-ring">
                <option value="">Any condition</option>
                {Object.entries(CONDITION_LABELS).filter(([k]) => k !== 'not_applicable').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Currency</label>
              <select value={filters.currency} onChange={(e) => update('currency', e.target.value)} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-ring">
                <option value="">Any currency</option>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Price range</label>
              <div className="flex items-center gap-2">
                <input type="number" placeholder="Min" value={filters.minPrice} onChange={(e) => update('minPrice', e.target.value)} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-ring" />
                <span className="text-muted-foreground">–</span>
                <input type="number" placeholder="Max" value={filters.maxPrice} onChange={(e) => update('maxPrice', e.target.value)} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-ring" />
              </div>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setShowFilters((v) => !v)}>
              <SlidersHorizontal className="mr-2 h-4 w-4" /> Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-sm text-muted-foreground sm:block">Sort:</span>
              <select value={filters.sort} onChange={(e) => update('sort', e.target.value)} className="h-9 rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-ring">
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />)}
            </div>
          ) : filtered.length ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((listing) => (
                <ListingCard key={listing.id} listing={listing} seller={sellerMap[listing.seller_id || listing.created_by_id]} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Package}
              title="No listings match your search"
              description="Try adjusting your filters or search terms."
            />
          )}
        </div>
      </div>
    </div>
  );
}