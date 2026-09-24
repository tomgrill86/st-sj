import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Package, MoreHorizontal, Eye, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import ListingCard from '@/components/marketplace/ListingCard';
import EmptyState from '@/components/marketplace/EmptyState';
import { Button } from '@/components/ui/button';
import { STATUS_LABELS, STATUS_STYLES } from '@/lib/marketplace';

export default function MyListings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openMenu, setOpenMenu] = useState(null);

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['my-listings'],
    queryFn: () => base44.entities.Listing.filter({ created_by_id: user.id }, '-created_date', 100),
  });

  const updateStatus = async (id, status) => {
    await base44.entities.Listing.update(id, { status, ...(status === 'published' ? { published_at: new Date().toISOString() } : {}) });
    qc.invalidateQueries({ queryKey: ['my-listings'] });
    setOpenMenu(null);
  };

  const remove = async (id) => {
    if (!confirm('Delete this listing permanently?')) return;
    await base44.entities.Listing.delete(id);
    qc.invalidateQueries({ queryKey: ['my-listings'] });
    setOpenMenu(null);
  };

  const drafts = listings.filter((l) => l.status === 'draft');
  const active = listings.filter((l) => l.status === 'published');
  const sold = listings.filter((l) => l.status === 'sold');
  const other = listings.filter((l) => ['closed', 'removed'].includes(l.status));

  const Section = ({ title, items, emptyText }) => (
    <div className="mb-10">
      <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
        {title} <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
      </h2>
      {items.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((listing) => (
            <div key={listing.id} className="relative">
              <ListingCard listing={listing} seller={user} />
              <div className="mt-2 flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[listing.status]}`}>{STATUS_LABELS[listing.status]}</span>
                <div className="relative">
                  <button onClick={() => setOpenMenu(openMenu === listing.id ? null : listing.id)} className="rounded-md p-1 hover:bg-muted" aria-label="Actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {openMenu === listing.id && (
                    <div className="absolute right-0 top-8 z-10 w-40 rounded-lg border border-border bg-popover p-1 shadow-lg">
                      <Link to={`/listing/${listing.id}`} className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-muted"><Eye className="h-3.5 w-3.5" />View</Link>
                      <Link to={`/sell?edit=${listing.id}`} className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-muted"><Pencil className="h-3.5 w-3.5" />Edit</Link>
                      {listing.status === 'draft' && (
                        <button onClick={() => updateStatus(listing.id, 'published')} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted">Publish</button>
                      )}
                      {listing.status === 'published' && (
                        <button onClick={() => updateStatus(listing.id, 'closed')} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted">Close</button>
                      )}
                      <button onClick={() => remove(listing.id)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-destructive hover:bg-muted"><Trash2 className="h-3.5 w-3.5" />Delete</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">My listings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage everything you're selling.</p>
        </div>
        <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to="/sell"><Plus className="mr-2 h-4 w-4" />Sell something</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : listings.length ? (
        <>
          <Section title="Active" items={active} emptyText="No active listings." />
          <Section title="Drafts" items={drafts} emptyText="No drafts." />
          <Section title="Sold" items={sold} emptyText="No sold listings." />
          {other.length > 0 && <Section title="Closed / Removed" items={other} emptyText="" />}
        </>
      ) : (
        <EmptyState icon={Package} title="You haven't listed anything yet" description="Lag din første annonse og begynn å selge på STÆSJ." actionLabel="Sell something" actionTo="/sell" />
      )}
    </div>
  );
}