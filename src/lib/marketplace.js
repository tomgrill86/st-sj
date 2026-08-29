import { base44 } from '@/api/base44Client';

// Condition labels and styles
export const CONDITION_LABELS = {
  new: 'New',
  like_new: 'Like New',
  used: 'Used',
  refurbished: 'Refurbished',
  not_applicable: 'N/A',
};

// Listing status labels (maps the stored enum to marketplace-facing terms)
export const STATUS_LABELS = {
  draft: 'Draft',
  published: 'Active',
  sold: 'Sold',
  closed: 'Closed',
  removed: 'Removed',
};

// Maps stored status -> marketplace-facing "public" status for display
export const PUBLIC_STATUS = {
  draft: 'draft',
  published: 'active',
  sold: 'sold',
  closed: 'closed',
  removed: 'removed',
};

export const STATUS_STYLES = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  sold: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  closed: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  removed: 'bg-destructive/10 text-destructive',
};

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

// Currency formatting (locale-aware, graceful fallback)
const CURRENCY_LOCALE = {
  USD: 'en-US',
  EUR: 'en-IE',
  GBP: 'en-GB',
  JPY: 'ja-JP',
  CAD: 'en-CA',
  AUD: 'en-AU',
  INR: 'en-IN',
  BRL: 'pt-BR',
  ZAR: 'en-ZA',
  NGN: 'en-NG',
  AED: 'ar-AE',
};

export function formatPrice(amount, currency = 'USD') {
  if (amount == null || isNaN(amount)) return '—';
  const locale = CURRENCY_LOCALE[currency] || 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'JPY' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toLocaleString()}`;
  }
}

export function timeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Fetch all active categories (cached lightly via react-query at call sites)
export async function fetchCategories() {
  const cats = await base44.entities.Category.list('sort_order', 200);
  return cats || [];
}

// Fetch a user's public profile fields
export function publicUserFields(user) {
  if (!user) return null;
  return {
    id: user.id,
    full_name: user.full_name,
    username: user.username,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    bio: user.bio,
    country: user.country,
    city_or_region: user.city_or_region,
    location: user.location,
    verified: user.verified,
    seller_since: user.seller_since,
    seller_rating: user.seller_rating,
    completed_sales_count: user.completed_sales_count,
    created_date: user.created_date,
  };
}

export function userDisplayName(user) {
  return user?.full_name || user?.username || user?.display_name || user?.email?.split('@')[0] || 'VENDRA member';
}

export function userHandle(user) {
  if (user?.username) return `@${user.username}`;
  return '';
}

export function userLocation(user) {
  return [user?.city_or_region, user?.country].filter(Boolean).join(', ') || user?.location || '';
}