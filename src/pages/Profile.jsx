import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Calendar, Star, ShoppingBag, Camera, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import StarRating from '@/components/marketplace/StarRating';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDate, userDisplayName, userLocation } from '@/lib/marketplace';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR', 'BRL', 'ZAR', 'NGN', 'AED'];

export default function Profile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    username: user?.username || '',
    display_name: user?.display_name || '',
    bio: user?.bio || '',
    country: user?.country || '',
    city_or_region: user?.city_or_region || '',
    preferred_currency: user?.preferred_currency || 'USD',
    avatar_url: user?.avatar_url || '',
    website: user?.website || '',
    phone: user?.phone || '',
  });

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onAvatar = async (file) => {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      update('avatar_url', file_url);
    } catch {
      setError('Avatar upload failed.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      await base44.entities.User.update(user.id, {
        username: form.username.trim() || null,
        display_name: form.display_name.trim() || null,
        bio: form.bio.trim(),
        country: form.country.trim(),
        city_or_region: form.city_or_region.trim(),
        preferred_currency: form.preferred_currency,
        avatar_url: form.avatar_url || null,
        website: form.website.trim() || null,
        phone: form.phone.trim() || null,
      });
      await qc.invalidateQueries({ queryKey: ['seller'] });
      setEditing(false);
      setSaving(false);
    } catch (e) {
      setError(e?.message || 'Could not save profile.');
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Your profile</h1>
        {!editing && <Button onClick={() => setEditing(true)} variant="outline">Edit profile</Button>}
      </div>

      {error && <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}

      {/* Profile header */}
      <div className="rounded-2xl border border-border/60 bg-card p-6">
        <div className="flex items-start gap-5">
          <div className="relative">
            <Avatar className="h-20 w-20 border border-border">
              {form.avatar_url ? <AvatarImage src={form.avatar_url} /> : null}
              <AvatarFallback className="bg-muted text-2xl font-medium">{userDisplayName(user).charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            {editing && (
              <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full border border-border bg-background p-1.5 shadow-sm hover:bg-muted">
                <Camera className="h-3.5 w-3.5" />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onAvatar(e.target.files?.[0])} disabled={uploadingAvatar} />
              </label>
            )}
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-semibold">{userDisplayName(user)}</h2>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            {user?.username && <p className="text-sm text-muted-foreground">@{user.username}</p>}
            {userLocation(user) && <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{userLocation(user)}</p>}
          </div>
        </div>

        {/* Stats (read-only, server-managed) */}
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-6 sm:grid-cols-4">
          <div className="text-center">
            <div className="flex items-center justify-center"><StarRating value={user?.seller_rating || 0} size={16} /></div>
            <p className="mt-1 text-xs text-muted-foreground">Seller rating</p>
          </div>
          <div className="text-center">
            <p className="font-display text-lg font-semibold">{user?.completed_sales_count || 0}</p>
            <p className="text-xs text-muted-foreground">Sales</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center"><StarRating value={user?.buyer_rating || 0} size={16} /></div>
            <p className="mt-1 text-xs text-muted-foreground">Buyer rating</p>
          </div>
          <div className="text-center">
            <p className="font-display text-lg font-semibold">{user?.completed_purchases_count || 0}</p>
            <p className="text-xs text-muted-foreground">Purchases</p>
          </div>
        </div>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">Ratings and counts are managed securely and cannot be edited manually.</p>
      </div>

      {/* Edit form */}
      {editing ? (
        <div className="mt-6 space-y-4 rounded-2xl border border-border/60 bg-card p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Username</label>
              <input value={form.username} onChange={(e) => update('username', e.target.value)} placeholder="@handle" className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Display name</label>
              <input value={form.display_name} onChange={(e) => update('display_name', e.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Country</label>
              <input value={form.country} onChange={(e) => update('country', e.target.value)} placeholder="Country" className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">City / Region</label>
              <input value={form.city_or_region} onChange={(e) => update('city_or_region', e.target.value)} placeholder="City or region" className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Preferred currency</label>
              <select value={form.preferred_currency} onChange={(e) => update('preferred_currency', e.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Website</label>
              <input value={form.website} onChange={(e) => update('website', e.target.value)} placeholder="https://" className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Bio</label>
            <textarea value={form.bio} onChange={(e) => update('bio', e.target.value)} rows={4} placeholder="Tell buyers about yourself" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Phone (optional)</label>
            <input value={form.phone} onChange={(e) => update('phone', e.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring" />
          </div>
          <div className="flex gap-3">
            <Button onClick={save} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90"><Save className="mr-2 h-4 w-4" />{saving ? 'Saving…' : 'Save changes'}</Button>
            <Button onClick={() => setEditing(false)} variant="ghost">Cancel</Button>
          </div>
        </div>
      ) : (
        user?.bio && (
          <div className="mt-6 rounded-2xl border border-border/60 bg-card p-6">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">About</h3>
            <p className="whitespace-pre-line text-sm leading-relaxed">{user.bio}</p>
          </div>
        )
      )}
    </div>
  );
}