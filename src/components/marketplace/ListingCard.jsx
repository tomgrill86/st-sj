import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Heart } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Image } from '@/components/ui/image';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { formatPrice, STATUS_LABELS, timeAgo } from '@/lib/marketplace';

export default function ListingCard({ listing, seller }) {
  const cover = listing?.images?.[0];
  const status = listing?.status;
  const { user, isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const { data: myFavorite } = useQuery({
    queryKey: ['my-favorite', listing.id],
    queryFn: async () => {
      const res = await base44.entities.Favorite.filter({ listing_id: listing.id }, '-created_date', 1);
      return res?.[0] || null;
    },
    enabled: isAuthenticated,
    staleTime: 30000,
  });

  const toggleFavorite = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) { navigate('/login'); return; }
    setBusy(true);
    try {
      if (myFavorite) {
        await base44.entities.Favorite.delete(myFavorite.id);
      } else {
        await base44.entities.Favorite.create({
          listing_id: listing.id,
          listing_title: listing.title,
          listing_image: listing.images?.[0],
          listing_price: listing.price,
          listing_currency: listing.currency,
          listing_status: listing.status,
        });
      }
      qc.invalidateQueries({ queryKey: ['my-favorite', listing.id] });
      qc.invalidateQueries({ queryKey: ['favorites'] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:border-border hover:-translate-y-0.5">
      <Link to={`/listing/${listing.id}`} className="flex flex-1 flex-col">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {cover ? (
            <Image
              src={cover}
              alt={listing.title}
              fittingType="fill"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground/30">
              <span className="font-display text-3xl font-bold">S</span>
            </div>
          )}
          {status && status !== 'published' && (
            <span className="absolute left-2.5 top-2.5 rounded-md bg-background/90 px-2 py-0.5 text-xs font-medium capitalize text-foreground backdrop-blur">
              {STATUS_LABELS[status] || status}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-3">
          <p className="font-display text-lg font-bold tracking-tight">{formatPrice(listing.price, listing.currency)}</p>
          <h3 className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-foreground/90">{listing.title}</h3>
          <div className="mt-auto flex items-center gap-2 pt-2 text-xs text-muted-foreground">
            {listing.location && (
              <span className="inline-flex min-w-0 items-center gap-0.5 truncate">
                <MapPin className="h-3 w-3 shrink-0" />{listing.location}
              </span>
            )}
            <span className="ml-auto shrink-0">{timeAgo(listing.created_date)}</span>
          </div>
        </div>
      </Link>

      <button
        onClick={toggleFavorite}
        disabled={busy}
        aria-label="Favoritt"
        className="absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition hover:bg-background active:scale-90 disabled:opacity-50"
      >
        <Heart className={`h-4 w-4 transition ${myFavorite ? 'fill-accent text-accent' : ''}`} />
      </button>
    </div>
  );
}