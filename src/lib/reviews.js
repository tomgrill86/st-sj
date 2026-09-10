import { base44 } from '@/api/base44Client';

// Fetch all public reviews for a seller, newest first.
export async function fetchReviews(sellerId) {
  const reviews = await base44.entities.Review.filter({ seller_id: sellerId }, '-created_date', 200);
  return reviews || [];
}

// Fetch the current user's existing review of a seller (one per buyer per seller).
export async function fetchMyReview(sellerId, userId) {
  const res = await base44.entities.Review.filter({ seller_id: sellerId, reviewer_id: userId }, '-created_date', 1);
  return res?.[0] || null;
}

// Whether the current user has any conversation with the seller (transaction proxy).
export async function hasConversationWith(sellerId, userId) {
  const convs = await base44.entities.Conversation.list('-last_message_at', 100);
  return (convs || []).some((c) => c.participant_ids?.includes(sellerId) && c.participant_ids?.includes(userId));
}

// Average + count + 5→1 star distribution from a list of reviews.
export function computeStats(reviews) {
  const count = reviews.length;
  if (count === 0) return { average: 0, count: 0, distribution: [0, 0, 0, 0, 0] };
  const sum = reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0);
  const distribution = [5, 4, 3, 2, 1].map((star) =>
    reviews.filter((r) => Math.round(Number(r.rating)) === star).length
  );
  return { average: sum / count, count, distribution };
}

export async function submitReview({ sellerId, reviewerId, rating, body }) {
  return base44.entities.Review.create({
    seller_id: sellerId,
    reviewer_id: reviewerId,
    rating,
    body: (body || '').trim() || null,
  });
}