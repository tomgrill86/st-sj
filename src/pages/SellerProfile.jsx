import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Calendar, Package, MessageSquare } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import ListingCard from '@/components/marketplace/ListingCard';
import StarRating from '@/components/marketplace/StarRating';
import ReviewList from '@/components/marketplace/ReviewList';
import ReviewForm from '@/components/marketplace/ReviewForm';
import EmptyState from '@/components/marketplace/EmptyState';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { userDisplayName, userHandle, userLocation, formatDate } from '@/lib/marketplace';
import { fetchReviews, fetchMyReview, computeStats } from '@/lib/reviews';

export default function SellerProfile() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [reviewOpen, setReviewOpen] = useState(false);

  const isOwner = user?.id === id;

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

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ['reviews', id],
    queryFn: () => fetchReviews(id),
    enabled: !!id,
  });

  // Resolve reviewer profiles for display.
  const reviewerIds = Array.from(new Set(reviews.map((r) => r.reviewer_id).filter(Boolean)));
  const { data: reviewers = [] } = useQuery({
    queryKey: ['reviewers', reviewerIds.join(',')],
    queryFn: () => Promise.all(reviewerIds.map((rid) => base44.entities.User.get(rid).catch(() => null))),
    enabled: reviewerIds.length > 0,
  });
  const reviewerMap = {};
  reviewers.forEach((u) => { if (u) reviewerMap[u.id] = u; });

  const { data: myReview } = useQuery({
    queryKey: ['my-review', id, user?.id],
    queryFn: () => fetchMyReview(id, user.id),
    enabled: isAuthenticated && !isOwner && !!user?.id,
  });

  // Eligibility: must have interacted with the seller (conversation = transaction proxy).
  const { data: myConvs = [] } = useQuery({
    queryKey: ['my-conversations'],
    queryFn: () => base44.entities.Conversation.list('-last_message_at', 100),
    enabled: isAuthenticated && !isOwner,
  });
  const hasConversation = myConvs.some((c) => c.participant_ids?.includes(id));
  const canReview = isAuthenticated && !isOwner && hasConversation && !myReview;

  const stats = computeStats(reviews);

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
            {stats.count > 0 && <StarRating value={stats.average} size={14} showValue />}
            <span>{stats.count} review{stats.count === 1 ? '' : 's'}</span>
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

      {/* Reviews */}
      <section className="mt-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Reviews</h2>
          {isAuthenticated && !isOwner && !myReview && (
            canReview ? (
              <Button onClick={() => setReviewOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <MessageSquare className="mr-2 h-4 w-4" />Write a review
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">Message this seller before leaving a review</span>
            )
          )}
          {myReview && (
            <span className="text-xs text-muted-foreground">You've reviewed this seller</span>
          )}
        </div>

        {reviewsLoading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        ) : (
          <ReviewList reviews={reviews} reviewerMap={reviewerMap} myUserId={user?.id} />
        )}
      </section>

      {/* Listings */}
      <div className="mt-12">
        <h2 className="mb-6 font-display text-2xl font-semibold tracking-tight">Listings by {userDisplayName(seller)}</h2>
        {listings.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((listing) => <ListingCard key={listing.id} listing={listing} seller={seller} />)}
          </div>
        ) : (
          <EmptyState icon={Package} title="No active listings" description="This seller has no active listings right now." />
        )}
      </div>

      {seller && user && (
        <ReviewForm open={reviewOpen} onOpenChange={setReviewOpen} seller={seller} me={user} />
      )}
    </div>
  );
}