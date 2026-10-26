import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Package, Tag, BarChart3, ShieldCheck, Plus, Pencil, Trash2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatPrice, formatDate, userDisplayName, STATUS_LABELS, STATUS_STYLES, timeAgo } from '@/lib/marketplace';

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'listings', label: 'Listings', icon: Package },
  { id: 'categories', label: 'Categories', icon: Tag },
];

export default function Admin() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');

  if (user?.role !== 'admin') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Admin access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">You don't have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Admin dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage users, listings, and categories.</p>
      </div>

      <div className="mb-8 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${tab === t.id ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview />}
      {tab === 'users' && <UsersTab />}
      {tab === 'listings' && <ListingsTab />}
      {tab === 'categories' && <CategoriesTab />}
    </div>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 font-display text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function Overview() {
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: () => base44.entities.User.list('-created_date', 200) });
  const { data: listings = [] } = useQuery({ queryKey: ['admin-listings'], queryFn: () => base44.entities.Listing.list('-created_date', 200) });

  const active = listings.filter((l) => l.status === 'published');
  const sold = listings.filter((l) => l.status === 'sold');
  const removed = listings.filter((l) => l.status === 'removed');
  const recentUsers = users.slice(0, 5);
  const recentListings = listings.slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total users" value={users.length} icon={Users} />
        <StatCard label="Active listings" value={active.length} icon={Package} />
        <StatCard label="Sold listings" value={sold.length} icon={Package} />
        <StatCard label="Removed listings" value={removed.length} icon={Package} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h3 className="mb-4 font-medium">Recently registered</h3>
          <div className="space-y-3">
            {recentUsers.length ? recentUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-3">
                <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{userDisplayName(u).charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1"><p className="truncate text-sm">{userDisplayName(u)}</p><p className="text-xs text-muted-foreground">{u.email}</p></div>
                <span className="text-xs text-muted-foreground">{timeAgo(u.created_date)}</span>
              </div>
            )) : <p className="text-sm text-muted-foreground">No users yet.</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h3 className="mb-4 font-medium">Recently created listings</h3>
          <div className="space-y-3">
            {recentListings.length ? recentListings.map((l) => (
              <div key={l.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1"><p className="truncate text-sm">{l.title}</p><p className="text-xs text-muted-foreground">{formatPrice(l.price, l.currency)}</p></div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[l.status]}`}>{STATUS_LABELS[l.status]}</span>
                <span className="text-xs text-muted-foreground">{timeAgo(l.created_date)}</span>
              </div>
            )) : <p className="text-sm text-muted-foreground">No listings yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: () => base44.entities.User.list('-created_date', 200) });

  const setStatus = async (id, status) => {
    await base44.entities.User.update(id, { status });
    qc.invalidateQueries({ queryKey: ['admin-users'] });
  };

  if (isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3 text-right">Actions</th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-muted/20">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">{u.avatar_url ? <AvatarImage src={u.avatar_url} /> : null}<AvatarFallback className="text-xs">{userDisplayName(u).charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                  <div className="min-w-0"><p className="truncate font-medium">{userDisplayName(u)}</p><p className="truncate text-xs text-muted-foreground">{u.email}</p></div>
                </div>
              </td>
              <td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{u.role}</span></td>
              <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${u.status === 'suspended' ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600'}`}>{u.status || 'active'}</span></td>
              <td className="px-4 py-3 text-muted-foreground">{formatDate(u.created_date)}</td>
              <td className="px-4 py-3 text-right">
                {u.role !== 'admin' && (u.status === 'suspended' ? (
                  <Button size="sm" variant="outline" onClick={() => setStatus(u.id, 'active')}>Reactivate</Button>
                ) : (
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => setStatus(u.id, 'suspended')}>Suspend</Button>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListingsTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const { data: listings = [], isLoading } = useQuery({ queryKey: ['admin-listings'], queryFn: () => base44.entities.Listing.list('-created_date', 200) });

  const filtered = filter === 'all' ? listings : listings.filter((l) => l.status === filter);

  const setStatus = async (id, status) => {
    await base44.entities.Listing.update(id, { status, ...(status === 'published' ? { published_at: new Date().toISOString() } : {}) });
    qc.invalidateQueries({ queryKey: ['admin-listings'] });
  };

  if (isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;

  const FILTERS = ['all', 'published', 'draft', 'sold', 'closed', 'removed'];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>{f}</button>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3">Listing</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((l) => (
              <tr key={l.id} className="hover:bg-muted/20">
                <td className="px-4 py-3"><p className="truncate font-medium">{l.title}</p></td>
                <td className="px-4 py-3">{formatPrice(l.price, l.currency)}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[l.status]}`}>{STATUS_LABELS[l.status]}</span></td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(l.created_date)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {l.status === 'removed' ? (
                      <Button size="sm" variant="outline" onClick={() => setStatus(l.id, 'published')}>Restore</Button>
                    ) : (
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => setStatus(l.id, 'removed')}>Remove</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoriesTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const { data: categories = [], isLoading } = useQuery({ queryKey: ['categories'], queryFn: () => base44.entities.Category.list('sort_order', 200) });

  const blank = { name: '', slug: '', description: '', parent_id: '', icon: '', sort_order: 0, active: true };
  const [form, setForm] = useState(blank);

  const startEdit = (cat) => { setEditing(cat); setForm({ name: cat.name, slug: cat.slug, description: cat.description || '', parent_id: cat.parent_id || '', icon: cat.icon || '', sort_order: cat.sort_order || 0, active: cat.active !== false }); setShowForm(true); };
  const startNew = () => { setEditing(null); setForm(blank); setShowForm(true); };

  const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const save = async () => {
    const payload = { ...form, slug: form.slug || slugify(form.name), sort_order: Number(form.sort_order) || 0 };
    if (editing) await base44.entities.Category.update(editing.id, payload);
    else await base44.entities.Category.create(payload);
    qc.invalidateQueries({ queryKey: ['categories'] });
    setShowForm(false);
  };

  const remove = async (id) => {
    if (!confirm('Delete this category?')) return;
    await base44.entities.Category.delete(id);
    qc.invalidateQueries({ queryKey: ['categories'] });
  };

  if (isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={startNew} className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />New category</Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border border-border/60 bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-medium">{editing ? 'Edit category' : 'New category'}</h3>
            <button onClick={() => setShowForm(false)} className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className="mb-1.5 block text-sm font-medium">Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring" /></div>
            <div><label className="mb-1.5 block text-sm font-medium">Slug</label><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring" /></div>
            <div><label className="mb-1.5 block text-sm font-medium">Parent category (optional)</label>
              <select value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring">
                <option value="">None (top level)</option>
                {categories.filter((c) => c.id !== editing?.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="mb-1.5 block text-sm font-medium">Icon (optional)</label><input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="lucide icon name" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring" /></div>
            <div><label className="mb-1.5 block text-sm font-medium">Sort order</label><input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring" /></div>
            <div className="flex items-end"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Active</label></div>
            <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium">Description</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring" /></div>
          </div>
          <div className="mt-4 flex gap-3"><Button onClick={save} className="bg-accent text-accent-foreground hover:bg-accent/90">{editing ? 'Save' : 'Create'}</Button><Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button></div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Slug</th><th className="px-4 py-3">Active</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {categories.map((c) => (
              <tr key={c.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.slug}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${c.active !== false ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>{c.active !== false ? 'Active' : 'Hidden'}</span></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => startEdit(c)} className="rounded-md p-1.5 hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(c.id)} className="rounded-md p-1.5 text-destructive hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!categories.length && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No categories yet. Create one to get started.</p>}
      </div>
    </div>
  );
}