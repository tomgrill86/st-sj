import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { formatPrice, CONDITION_LABELS, timeAgo } from '@/lib/marketplace';
import StarRating from './StarRating';

export default function ListingCard({ listing, seller }) {
  const cover = listing?.images?.[0];
  const status = listing?.status;

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-all hover:border-border hover:shadow-lg hover:shadow-black/[0.03] hover:-translate-y-0.5"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {cover ? (
          <Image
            src={cover}
            alt={listing.title}
            fittingType="fill"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground/40">
            <span className="font-display text-3xl">V</span>
          </div>
        )}
        {status && status !== 'published' && (
          <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium capitalize text-foreground shadow-sm backdrop-blur">
            {status}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{listing.title}</h3>
        </div>

        <p className="mt-1.5 font-display text-lg font-semibold tracking-tight">
          {formatPrice(listing.price, listing.currency)}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {listing.condition && listing.condition !== 'not_applicable' && (
            <span className="rounded-md bg-muted px-1.5 py-0.5">{CONDITION_LABELS[listing.condition] || listing.condition}</span>
          )}
          {listing.location && (
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />{listing.location}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between pt-3 text-xs text-muted-foreground">
          <span className="truncate">{seller?.username ? `@${seller.username}` : seller?.full_name || 'Seller'}</span>
          <span className="flex items-center gap-1">
            {seller && Number(seller.seller_rating) > 0 && <StarRating value={seller.seller_rating} size={12} showValue />}
            <span className="text-[11px]">{timeAgo(listing.created_date)}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}