import { Link } from 'react-router-dom';
import {
  Tag, Car, Home, Smartphone, Shirt, Footprints, Sofa, Dumbbell,
  Gamepad2, Wrench, Ship, Bike, Baby, PawPrint, Briefcase, Package,
} from 'lucide-react';

// Maps category slug/name (lowercased) to a clean, modern lucide icon.
const ICONS = {
  biler: Car, bil: Car,
  bolig: Home,
  elektronikk: Smartphone,
  klr: Shirt, 'klær': Shirt,
  sko: Footprints,
  hjem: Home,
  mobler: Sofa, 'møbler': Sofa,
  sport: Dumbbell,
  fritid: Package,
  gaming: Gamepad2,
  verktoy: Wrench, 'verktøy': Wrench,
  samleobjekter: Tag,
  bat: Ship, 'båt': Ship,
  mc: Bike,
  barn: Baby,
  dyr: PawPrint,
  tjenester: Briefcase,
  annet: Package,
};

function iconFor(cat) {
  const key = (cat.slug || cat.name || '').toLowerCase();
  return ICONS[key] || Tag;
}

// Renders categories from the Category entity. Shows a graceful empty state
// when no categories have been seeded yet.
export default function CategoryGrid({ categories = [], limit }) {
  const items = limit ? categories.slice(0, limit) : categories;

  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          Kategorier vises her så snart en administrator har lagt dem til.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {items.map((cat) => {
        const Icon = iconFor(cat);
        return (
          <Link
            key={cat.id}
            to={`/browse?category=${encodeURIComponent(cat.slug)}`}
            className="group flex flex-col items-center justify-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-6 text-center transition hover:border-border hover:bg-muted/40"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-foreground transition group-hover:bg-accent group-hover:text-accent-foreground">
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <span className="text-sm font-medium leading-tight">{cat.name}</span>
          </Link>
        );
      })}
    </div>
  );
}