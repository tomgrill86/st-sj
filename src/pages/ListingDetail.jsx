import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { MapPin, Calendar, Tag, Heart, MessageCircle, ShoppingBag, ArrowLeft, ShieldAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import ImageGallery from '@/components/marketplace/ImageGallery';
import StarRating from '@/components/marketplace/StarRating';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatPrice, CONDITION_LABELS, formatDate, userDisplayName, userHandle, userLocation } from '@/lib/marketplace';
import { getOrCreateConversation } from '@/lib/messaging';
import { toast } from '@/components/ui/use-toast';

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const qc = useQueryClient();

  const { data: listing, isLoading } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => base44.entities.Listing.get(id),
    retry: false,
  });

  const sellerId = listing?.seller_id || listing?.created_by_id;
  const { data: seller } = useQuery({
    queryKey: ['seller', sellerId],
    queryFn: () => base44.entities.User.get(sellerId),
    enabled: !!sellerId,
  });

  // Is this listing viewable by the current user?
  const isOwner = listing && user && (listing.created_by_id === user.id);
  const isAdmin = user?.role === 'admin';
  const viewable = listing && (listing.status === 'published' || isOwner || isAdmin);

  // Favorite state
  const { data: myFavorite } = useQuery({
    queryKey: ['my-favorite', id],
    queryFn: async () => {
      const res = await base44.entities.Favorite.filter({ listing_id: id }, '-created_date', 1);
      return res?.[0] || null;
    },
    enabled: isAuthenticated,
  });
  const [favBusy, setFavBusy] = useState(false);
  const [msgBusy, setMsgBusy] = useState(false);

  const toggleFavorite = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setFavBusy(true);
    try {
      if (myFavorite) {
        await base44.entities.Favorite.delete(myFavorite.id);
      } else {
        await base44.entities.Favorite.create({
          listing_id: id,
          listing_title: listing.title,
          listing_image: listing.images?.[0],
          listing_price: listing.price,
          listing_currency: listing.currency,
          listing_status: listing.status,
        });
      }
      qc.invalidateQueries({ queryKey: ['my-favorite', id] });
      qc.invalidateQueries({ queryKey: ['favorites'] });
    } finally {
      setFavBusy(false);
    }
  };

  const contactSeller = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!sellerId || isOwner) return;
    setMsgBusy(true);
    try {
      const conv = await getOrCreateConversation({ listing, user, sellerId });
      navigate(`/messages?c=${conv.id}`);
    } catch (e) {
      toast({ title: 'Could not start conversation', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setMsgBusy(false);
    }
  };

  if (isLoading) {
    return <div className="mx-auto max-w-7xl px-4 py-10"><div className="h-96 animate-pulse rounded-2xl bg-muted" /></div>;
  }

  if (!listing || !viewable) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Listing not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">This listing may have been removed or is no longer public.</p>
        <Button asChild className="mt-6"><Link to="/browse">Back to browse</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/browse" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to browse
      </Link>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <ImageGallery images={listing.images || []} title={listing.title} />
        </div>

        {/* Details */}
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {listing.category && (
              <Link to={`/browse?category=${encodeURIComponent(listing.category)}`} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 hover:bg-muted/70">
                <Tag className="h-3 w-3" />{listing.category}
              </Link>
            )}
            {listing.subcategory && <span className="rounded-full bg-muted px-2.5 py-1">{listing.subcategory}</span>}
            {listing.condition && listing.condition !== 'not_applicable' && (
              <span className="rounded-full bg-muted px-2.5 py-1">{CONDITION_LABELS[listing.condition]}</span>
            )}
          </div>

          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{listing.title}</h1>
          <p className="mt-3 font-display text-4xl font-semibold tracking-tight">{formatPrice(listing.price, listing.currency)}</p>

          {listing.location && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />{listing.location}
            </p>
          )}

          {/* Actions */}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90" disabled title="Payments coming soon">
              <ShoppingBag className="mr-2 h-5 w-5" /> Buy
            </Button>
            <Button size="lg" variant="outline" onClick={contactSeller} disabled={msgBusy || isOwner} title={isOwner ? 'This is your listing' : 'Message the seller'}>
              <MessageCircle className="mr-2 h-5 w-5" /> {msgBusy ? 'Opening…' : 'Contact seller'}
            </Button>
            {isAuthenticated && (
              <Button size="lg" variant="ghost" onClick={toggleFavorite} disabled={favBusy}>
                <Heart className={`mr-2 h-5 w-5 ${myFavorite ? 'fill-accent text-accent' : ''}`} />
                {myFavorite ? 'Saved' : 'Save'}
              </Button>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Buying will be available in a later phase.</p>

          {/* Description */}
          <div className="mt-8 border-t border-border pt-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Description</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{listing.description || 'No description provided.'}</p>
          </div>

          {/* Meta */}
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Listed {formatDate(listing.published_at || listing.created_date)}</span>
            {Number(listing.view_count) > 0 && <span>{listing.view_count} views</span>}
            {Number(listing.favorite_count) > 0 && <span>{listing.favorite_count} saves</span>}
          </div>

          {/* Seller card */}
          {seller && (
            <Link to={`/seller/${seller.id}`} className="mt-8 flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-4 transition hover:border-border hover:bg-muted/30">
              <Avatar className="h-12 w-12 border border-border">
                {seller.avatar_url ? <AvatarImage src={seller.avatar_url} /> : null}
                <AvatarFallback className="bg-muted text-sm font-medium">{userDisplayName(seller).charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{userDisplayName(seller)}</p>
                  {seller.verified && <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">Verified</span>}
                </div>
                <p className="text-xs text-muted-foreground">{userHandle(seller) || userLocation(seller)}</p>
                <div className="mt-1 flex items-center gap-2">
                  {Number(seller.seller_rating) > 0 && <StarRating value={seller.seller_rating} size={12} showValue />}
                  <span className="text-xs text-muted-foreground">{seller.completed_sales_count || 0} sales</span>
                </div>
              </div>
            </Link>
          )}

          {isOwner && (
            <div className="mt-6 flex gap-3">
              <Button asChild variant="outline"><Link to={`/sell?edit=${listing.id}`}>Edit listing</Link></Button>
              <Button asChild variant="ghost"><Link to="/my-listings">Manage listings</Link></Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}