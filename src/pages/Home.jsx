import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Package } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import SearchBar from '@/components/marketplace/SearchBar';
import CategoryGrid from '@/components/marketplace/CategoryGrid';
import ListingCard from '@/components/marketplace/ListingCard';
import EmptyState from '@/components/marketplace/EmptyState';
import { Button } from '@/components/ui/button';
import { fetchCategories } from '@/lib/marketplace';

export default function Home() {
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const { data: recent = [] } = useQuery({
    queryKey: ['recent-listings'],
    queryFn: () => base44.entities.Listing.filter({ status: 'published' }, '-created_date', 12),
  });

  // Resolve sellers for the recent listings
  const sellerIds = Array.from(new Set(recent.map((l) => l.seller_id || l.created_by_id).filter(Boolean)));
  const { data: sellers = [] } = useQuery({
    queryKey: ['sellers', sellerIds.join(',')],
    queryFn: () => Promise.all(sellerIds.map((id) => base44.entities.User.get(id).catch(() => null))),
    enabled: sellerIds.length > 0,
  });
  const sellerMap = {};
  sellers.forEach((s) => { if (s) sellerMap[s.id] = s; });

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-muted/50 to-background" />
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="font-display text-5xl font-semibold tracking-tight text-balance sm:text-7xl">
              VENDRA
            </h1>
            <p className="mt-4 font-display text-xl text-muted-foreground sm:text-2xl">
              Buy. Sell. Your way.
            </p>
            <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
              A global marketplace for almost anything. Find what you need, or list what you have — simply.
            </p>

            <div className="mx-auto mt-10 max-w-2xl">
              <SearchBar large />
            </div>

            <div className="mt-6 flex items-center justify-center gap-3">
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/browse">Search <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/sell">Sell something</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Popular categories</h2>
            <p className="mt-1 text-sm text-muted-foreground">Browse by what you're looking for.</p>
          </div>
          <Link to="/browse" className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:block">
            View all →
          </Link>
        </div>
        <CategoryGrid categories={categories} limit={12} />
      </section>

      {/* Recent listings */}
      <section className="border-t border-border/60 bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Recently listed</h2>
              <p className="mt-1 text-sm text-muted-foreground">Fresh from sellers around the world.</p>
            </div>
            <Link to="/browse" className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:block">
              See more →
            </Link>
          </div>

          {recent.length ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {recent.map((listing) => (
                <ListingCard key={listing.id} listing={listing} seller={sellerMap[listing.seller_id || listing.created_by_id]} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Package}
              title="No listings yet"
              description="Be the first to list something on VENDRA."
              actionLabel="Sell something"
              actionTo="/sell"
            />
          )}
        </div>
      </section>
    </div>
  );
}