import { Link } from 'react-router-dom';
import { Image } from '@/components/ui/image';

// Renders categories from the Category entity. Shows a graceful empty state
// when no categories have been seeded yet (seeding happens on the main branch).
export default function CategoryGrid({ categories = [], limit }) {
  const items = limit ? categories.slice(0, limit) : categories;

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          Categories will appear here once an administrator adds them.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {items.map((cat) => (
        <Link
          key={cat.id}
          to={`/browse?category=${encodeURIComponent(cat.slug)}`}
          className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card px-3 py-6 text-center transition hover:border-border hover:bg-muted/40"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-foreground transition group-hover:bg-accent/10">
            <span className="font-display text-lg font-semibold">{cat.name?.charAt(0)}</span>
          </div>
          <span className="text-sm font-medium leading-tight">{cat.name}</span>
        </Link>
      ))}
    </div>
  );
}