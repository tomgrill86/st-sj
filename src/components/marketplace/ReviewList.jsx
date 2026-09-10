import { Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import StarRating from './StarRating';
import { computeStats } from '@/lib/reviews';
import { userDisplayName, timeAgo } from '@/lib/marketplace';

// Presentational: renders the aggregate rating breakdown + the list of reviews.
export default function ReviewList({ reviews = [], reviewerMap = {}, myUserId }) {
  const { average, count, distribution } = computeStats(reviews);

  return (
    <div className="space-y-6">
      {/* Aggregate breakdown */}
      <div className="flex flex-col gap-6 rounded-2xl border border-border/60 bg-card p-6 sm:flex-row sm:items-center">
        <div className="text-center sm:w-40 sm:shrink-0">
          <p className="font-display text-4xl font-semibold tracking-tight">{average.toFixed(1)}</p>
          <StarRating value={average} size={16} className="mt-1 justify-center" />
          <p className="mt-1 text-xs text-muted-foreground">
            {count} review{count === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex-1 space-y-1.5">
          {[5, 4, 3, 2, 1].map((star, idx) => {
            const c = distribution[idx];
            const pct = count ? (c / count) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="flex w-10 items-center gap-0.5 text-muted-foreground">
                  {star}<Star className="h-3 w-3 fill-current" />
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right text-muted-foreground">{c}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reviews list */}
      {count === 0 ? (
        <p className="rounded-2xl border border-border/60 bg-card p-6 text-center text-sm text-muted-foreground">
          No reviews yet. Be the first to review this seller.
        </p>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <ReviewItem key={r.id} review={r} reviewer={reviewerMap[r.reviewer_id]} mine={r.reviewer_id === myUserId} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewItem({ review, reviewer, mine }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9 border border-border">
          {reviewer?.avatar_url ? <AvatarImage src={reviewer.avatar_url} /> : null}
          <AvatarFallback className="bg-muted text-xs font-medium">
            {userDisplayName(reviewer).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{userDisplayName(reviewer)}</p>
            {mine && (
              <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">You</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{review.created_date ? timeAgo(review.created_date) : ''}</p>
        </div>
        <StarRating value={Number(review.rating) || 0} size={14} />
      </div>
      {review.body && (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{review.body}</p>
      )}
    </div>
  );
}