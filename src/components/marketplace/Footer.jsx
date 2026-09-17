import { Link } from 'react-router-dom';
import { Wordmark } from '@/components/brand/Logo';

export default function Footer() {
  return (
    <footer className="hidden border-t border-border bg-background md:block">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row">
          <div className="max-w-xs">
            <Wordmark sizeClass="text-2xl" />
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Alt. Ett sted. Kjøp, selg og bytt hva som helst.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-8 sm:grid-cols-3">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Utforsk</h4>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link to="/browse" className="text-muted-foreground transition hover:text-foreground">Bla gjennom</Link></li>
                <li><Link to="/sell" className="text-muted-foreground transition hover:text-foreground">Legg ut annonse</Link></li>
                <li><Link to="/favorites" className="text-muted-foreground transition hover:text-foreground">Favoritter</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Konto</h4>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link to="/profile" className="text-muted-foreground transition hover:text-foreground">Profil</Link></li>
                <li><Link to="/my-listings" className="text-muted-foreground transition hover:text-foreground">Mine annonser</Link></li>
                <li><Link to="/login" className="text-muted-foreground transition hover:text-foreground">Logg inn</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">STÆSJ</h4>
              <ul className="mt-3 space-y-2 text-sm">
                <li><span className="text-muted-foreground">Norsk markedsplass</span></li>
                <li><span className="text-muted-foreground">Undergrunn</span></li>
                <li><span className="text-muted-foreground">© {new Date().getFullYear()}</span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}