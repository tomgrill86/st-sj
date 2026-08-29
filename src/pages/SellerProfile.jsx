import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Calendar, Package } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ListingCard from '@/components/marketplace/ListingCard';
import StarRating from '@/components/marketplace/StarRating';
import EmptyState from '@/components/marketplace/EmptyState';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { userDisplayName, userHandle, userLocation, formatDate } from '@/lib/marketplace';

export default function SellerProfile() {
  const { id } = useParams();

  const { data: seller, isLoading } = useQuery({
    queryKey: ['seller', id],
    queryFn: () => base44.entities.User.get(id),
    retry: false,
  });

  const { data: listings = [] } = useQuery({
    queryKey: ['seller-listings', id],
    queryFn: () => base44.entities.Listing.filter({ status: 'published', seller_id: id }, '-created_date', 24),
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="mx-auto max-w-7xl px-4 py-10"><div className="h-40 animate-pulse rounded-2xl bg-muted" /></div>;
  }

  if (!seller) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">Seller not found</h1>
        <Button asChild className="mt-6"><Link to="/browse">Back to browse</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Profile header */}
      <div className="flex flex-col items-start gap-6 rounded-2xl border border-border/60 bg-card p-6 sm:flex-row sm:items-center">
        <Avatar className="h-20 w-20 border border-border">
          {seller.avatar_url ? <AvatarImage src={seller.avatar_url} /> : null}
          <AvatarFallback className="bg-muted text-2xl font-medium">{userDisplayName(seller).charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-semibold tracking-tight">{userDisplayName(seller)}</h1>
            {seller.verified && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">Verified</span>}
          </div>
          {userHandle(seller) && <p className="text-sm text-muted-foreground">{userHandle(seller)}</p>}
          {userLocation(seller) && (
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{userLocation(seller)}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {Number(seller.seller_rating) > 0 && <StarRating value={seller.seller_rating} size={14} showValue />}
            <span>{seller.completed_sales_count || 0} completed sales</span>
            {seller.seller_since && <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Seller since {formatDate(seller.seller_since)}</span>}
          </div>
        </div>
      </div>

      {seller.bio && (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card p-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">About</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{seller.bio}</p>
        </div>
      )}

      {/* Listings */}
      <div className="mt-10">
        <h2 className="mb-6 font-display text-2xl font-semibold tracking-tight">Listings by {userDisplayName(seller)}</h2>
        {listings.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((listing) => <ListingCard key={listing.id} listing={listing} seller={seller} />)}
          </div>
        ) : (
          <EmptyState icon={Package} title="No active listings" description="This seller has no active listings right now." />
        )}
      </div>
    </div>
  );
}