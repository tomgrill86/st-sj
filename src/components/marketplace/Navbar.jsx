import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Heart, Shield, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ThemeToggle from './ThemeToggle';
import Logo from '@/components/brand/Logo';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { userDisplayName } from '@/lib/marketplace';
import { totalUnread } from '@/lib/messaging';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  const submitSearch = (e) => {
    e.preventDefault();
    navigate(`/browse${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  };

  const { data: conversations = [] } = useQuery({
    queryKey: ['nav-conversations'],
    queryFn: () => base44.entities.Conversation.list('-last_message_at', 50),
    enabled: isAuthenticated,
    staleTime: 20000,
  });
  const unread = totalUnread(conversations, user?.id);
  const isAdmin = user?.role === 'admin';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="shrink-0" aria-label="STÆSJ">
          <Logo sizeClass="text-2xl" />
        </Link>

        {/* Desktop search */}
        <form onSubmit={submitSearch} className="relative hidden flex-1 max-w-xl md:block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Finn stæsj..."
            className="h-11 w-full rounded-full border border-border bg-card pl-10 pr-4 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </form>

        <div className="ml-auto flex items-center gap-1.5">
          {isAuthenticated && (
            <Button asChild variant="ghost" size="sm" className="relative hidden sm:flex">
              <Link to="/messages">
                <MessageCircle className="mr-2 h-4 w-4" />Meldinger
                {unread > 0 && <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">{unread}</span>}
              </Link>
            </Button>
          )}
          {isAuthenticated && (
            <Button asChild variant="ghost" size="sm" className="hidden sm:flex">
              <Link to="/favorites"><Heart className="mr-2 h-4 w-4" />Favoritter</Link>
            </Button>
          )}

          {isAuthenticated ? (
            <>
              <Button asChild size="sm" className="hidden sm:flex">
                <Link to="/sell"><Plus className="mr-1.5 h-4 w-4" />Selg stæsj</Link>
              </Button>
              <Link to="/profile" className="ml-1 hidden sm:block">
                <Avatar className="h-9 w-9 border border-border">
                  {user?.avatar_url ? <AvatarImage src={user.avatar_url} /> : null}
                  <AvatarFallback className="bg-muted text-xs font-medium">
                    {userDisplayName(user)?.charAt(0)?.toUpperCase() || 'S'}
                  </AvatarFallback>
                </Avatar>
              </Link>
              {isAdmin && (
                <Button asChild variant="ghost" size="icon" className="hidden sm:flex" aria-label="Admin">
                  <Link to="/admin"><Shield className="h-5 w-5" /></Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => logout()} className="hidden sm:flex">
                Logg ut
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:flex">
                <Link to="/login">Logg inn</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:flex">
                <Link to="/register">Bli med</Link>
              </Button>
            </>
          )}

          {/* Mobile: only theme + admin on the top row; nav lives in the bottom bar */}
          {isAdmin && (
            <Button asChild variant="ghost" size="icon" className="sm:hidden" aria-label="Admin">
              <Link to="/admin"><Shield className="h-5 w-5" /></Link>
            </Button>
          )}
          <ThemeToggle className="sm:hidden" />
        </div>
      </div>

      {/* Mobile search row */}
      <div className="border-t border-border/60 px-4 pb-3 pt-2 md:hidden">
        <form onSubmit={submitSearch} className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Finn stæsj..."
            className="h-11 w-full rounded-full border border-border bg-card pl-10 pr-4 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </form>
      </div>
    </header>
  );
}