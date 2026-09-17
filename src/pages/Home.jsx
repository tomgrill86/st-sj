import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import SearchBar from '@/components/marketplace/SearchBar';
import CategoryGrid from '@/components/marketplace/CategoryGrid';
import ListingCard from '@/components/marketplace/ListingCard';
import EmptyState from '@/components/marketplace/EmptyState';
import { Wordmark } from '@/components/brand/Logo';
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
      <section className="relative border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="font-display text-6xl font-bold tracking-tight sm:text-7xl">
              <Wordmark sizeClass="text-6xl sm:text-7xl" />
            </h1>
            <p className="mt-3 font-display text-xl text-muted-foreground sm:text-2xl">Alt. Ett sted.</p>

            <div className="mx-auto mt-8 max-w-xl">
              <SearchBar large placeholder="Hva leter du etter?" />
            </div>

            <p className="mt-4 text-sm font-medium tracking-wide text-muted-foreground">Kjøp · Selg · Bytt</p>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Kategorier</h2>
          <Link to="/browse" className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
            Se alt →
          </Link>
        </div>
        <CategoryGrid categories={categories} limit={12} />
      </section>

      {/* Popular now */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-display text-2xl font-semibold tracking-tight">Populært akkurat nå</h2>
            <Link to="/browse" className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
              Se mer →
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
              title="Ingen annonser ennå"
              description="Bli den første til å legge ut noe på STÆSJ."
              actionLabel="Legg ut annonse"
              actionTo="/sell"
            />
          )}
        </div>
      </section>
    </div>
  );
}