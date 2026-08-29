import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Heart, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import EmptyState from '@/components/marketplace/EmptyState';
import { Button } from '@/components/ui/button';
import { Image } from '@/components/ui/image';
import { formatPrice, CONDITION_LABELS } from '@/lib/marketplace';

export default function Favorites() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => base44.entities.Favorite.filter({ created_by_id: user.id }, '-created_date', 100),
  });

  const remove = async (id) => {
    await base44.entities.Favorite.delete(id);
    qc.invalidateQueries({ queryKey: ['favorites'] });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Saved listings</h1>
        <p className="mt-1 text-sm text-muted-foreground">{favorites.length} saved {favorites.length === 1 ? 'item' : 'items'}</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : favorites.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {favorites.map((fav) => (
            <div key={fav.id} className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card">
              <Link to={`/listing/${fav.listing_id}`} className="relative aspect-[4/3] overflow-hidden bg-muted">
                {fav.listing_image ? (
                  <Image src={fav.listing_image} alt={fav.listing_title} fittingType="fill" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground/30"><span className="font-display text-3xl">V</span></div>
                )}
                {fav.listing_status && fav.listing_status !== 'published' && (
                  <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium capitalize">{fav.listing_status}</span>
                )}
              </Link>
              <div className="flex flex-1 flex-col p-3.5">
                <Link to={`/listing/${fav.listing_id}`} className="line-clamp-2 text-sm font-medium hover:text-foreground">{fav.listing_title}</Link>
                <p className="mt-1.5 font-display text-lg font-semibold tracking-tight">{formatPrice(fav.listing_price, fav.listing_currency)}</p>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <span className="text-xs text-muted-foreground">{fav.listing_status === 'sold' ? 'Sold' : 'Available'}</span>
                  <button onClick={() => remove(fav.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Heart}
          title="No saved listings yet"
          description="Tap the heart on any listing to save it here."
          actionLabel="Browse listings"
          actionTo="/browse"
        />
      )}
    </div>
  );
}