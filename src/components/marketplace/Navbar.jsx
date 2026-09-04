import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Heart, LayoutGrid, User as UserIcon, Shield, Menu, X, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ThemeToggle from './ThemeToggle';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { userDisplayName } from '@/lib/marketplace';
import { totalUnread } from '@/lib/messaging';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const submitSearch = (e) => {
    e.preventDefault();
    navigate(`/browse${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
    setMenuOpen(false);
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
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="font-display text-2xl font-semibold tracking-tight">VENDRA</span>
        </Link>

        <form onSubmit={submitSearch} className="relative hidden flex-1 max-w-xl md:block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="What are you looking for?"
            className="h-11 w-full rounded-full border border-border bg-card pl-10 pr-4 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </form>

        <div className="ml-auto flex items-center gap-1.5">
          <Button asChild variant="ghost" size="sm" className="hidden sm:flex">
            <Link to="/browse"><LayoutGrid className="mr-2 h-4 w-4" />Browse</Link>
          </Button>

          {isAuthenticated && (
            <Button asChild variant="ghost" size="sm" className="hidden sm:flex">
              <Link to="/favorites"><Heart className="mr-2 h-4 w-4" />Saved</Link>
            </Button>
          )}

          {isAuthenticated && (
            <Button asChild variant="ghost" size="sm" className="relative hidden sm:flex">
              <Link to="/messages">
                <MessageCircle className="mr-2 h-4 w-4" />Messages
                {unread > 0 && <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">{unread}</span>}
              </Link>
            </Button>
          )}

          {isAuthenticated ? (
            <>
              <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/sell"><Plus className="mr-1.5 h-4 w-4" />Sell</Link>
              </Button>
              <Link to="/profile" className="ml-1 hidden sm:block">
                <Avatar className="h-9 w-9 border border-border">
                  {user?.avatar_url ? <AvatarImage src={user.avatar_url} /> : null}
                  <AvatarFallback className="bg-muted text-xs font-medium">
                    {userDisplayName(user)?.charAt(0)?.toUpperCase() || 'V'}
                  </AvatarFallback>
                </Avatar>
              </Link>
              {isAdmin && (
                <Button asChild variant="ghost" size="icon" className="hidden sm:flex" aria-label="Admin">
                  <Link to="/admin"><Shield className="h-5 w-5" /></Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => logout()} className="hidden sm:flex">
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:flex">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:flex bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/register">Join</Link>
              </Button>
            </>
          )}

          <ThemeToggle className="hidden sm:flex" />

          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="mx-auto max-w-7xl space-y-3 px-4 py-4">
            <form onSubmit={submitSearch} className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="What are you looking for?"
                className="h-11 w-full rounded-full border border-border bg-card pl-10 pr-4 text-sm outline-none"
              />
            </form>
            <div className="flex flex-col gap-1">
              <Link to="/browse" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted"><LayoutGrid className="h-4 w-4" />Browse</Link>
              {isAuthenticated && (
                <Link to="/favorites" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted"><Heart className="h-4 w-4" />Saved</Link>
              )}
              {isAuthenticated && (
                <Link to="/messages" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted">
                  <MessageCircle className="h-4 w-4" />Messages
                  {unread > 0 && <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">{unread}</span>}
                </Link>
              )}
              {isAuthenticated && (
                <Link to="/sell" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted"><Plus className="h-4 w-4" />Sell something</Link>
              )}
              {isAuthenticated && (
                <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted"><UserIcon className="h-4 w-4" />Profile</Link>
              )}
              {isAdmin && (
                <Link to="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted"><Shield className="h-4 w-4" />Admin</Link>
              )}
              <div className="flex items-center justify-between px-3 pt-2">
                <ThemeToggle />
                {isAuthenticated ? (
                  <Button variant="outline" size="sm" onClick={() => { logout(); setMenuOpen(false); }}>Sign out</Button>
                ) : (
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm"><Link to="/login" onClick={() => setMenuOpen(false)}>Sign in</Link></Button>
                    <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90"><Link to="/register" onClick={() => setMenuOpen(false)}>Join</Link></Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}