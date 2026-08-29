import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row">
          <div className="max-w-xs">
            <span className="font-display text-2xl font-semibold tracking-tight">VENDRA</span>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Buy. Sell. Your way. A global marketplace for almost anything.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-8 sm:grid-cols-3">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Explore</h4>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link to="/browse" className="hover:text-foreground text-muted-foreground transition">Browse</Link></li>
                <li><Link to="/sell" className="hover:text-foreground text-muted-foreground transition">Sell something</Link></li>
                <li><Link to="/favorites" className="hover:text-foreground text-muted-foreground transition">Saved</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account</h4>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link to="/profile" className="hover:text-foreground text-muted-foreground transition">Profile</Link></li>
                <li><Link to="/my-listings" className="hover:text-foreground text-muted-foreground transition">My listings</Link></li>
                <li><Link to="/login" className="hover:text-foreground text-muted-foreground transition">Sign in</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">VENDRA</h4>
              <ul className="mt-3 space-y-2 text-sm">
                <li><span className="text-muted-foreground">Privacy-focused</span></li>
                <li><span className="text-muted-foreground">Global</span></li>
                <li><span className="text-muted-foreground">© {new Date().getFullYear()}</span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}