import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Plus, MessageCircle, User } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { totalUnread } from '@/lib/messaging';
import { cn } from '@/lib/utils';

function NavItem({ to, icon: Icon, label, active, badge }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex flex-1 flex-col items-center gap-1 py-1.5 text-[10px] font-medium transition-colors',
        active ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <span className="relative">
        <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
        {badge > 0 && (
          <span className="absolute -right-2 -top-1.5 rounded-full bg-accent px-1.5 text-[9px] font-bold leading-4 text-accent-foreground">
            {badge}
          </span>
        )}
      </span>
      {label}
    </Link>
  );
}

export default function BottomNav() {
  const { pathname } = useLocation();
  const { user, isAuthenticated } = useAuth();

  const { data: conversations = [] } = useQuery({
    queryKey: ['nav-conversations'],
    queryFn: () => base44.entities.Conversation.list('-last_message_at', 50),
    enabled: isAuthenticated,
    staleTime: 20000,
  });
  const unread = totalUnread(conversations, user?.id);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-md items-end justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-1">
        <NavItem to="/" icon={Home} label="Hjem" active={pathname === '/'} />
        <NavItem to="/browse" icon={Search} label="Søk" active={pathname.startsWith('/browse')} />

        {/* Center sell action — stands out */}
        <Link
          to="/sell"
          className="relative -mt-5 flex flex-col items-center"
          aria-label="Selg"
        >
          <span
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full border border-border bg-accent text-accent-foreground shadow-lg shadow-accent/20 transition active:scale-95',
              pathname.startsWith('/sell') && 'ring-2 ring-ring ring-offset-2 ring-offset-background'
            )}
          >
            <Plus className="h-6 w-6" strokeWidth={2.25} />
          </span>
          <span className={cn('mt-1 text-[10px] font-medium', pathname.startsWith('/sell') ? 'text-accent' : 'text-muted-foreground')}>Selg</span>
        </Link>

        <NavItem to="/messages" icon={MessageCircle} label="Meldinger" active={pathname.startsWith('/messages')} badge={unread} />
        <NavItem to="/profile" icon={User} label="Profil" active={pathname.startsWith('/profile')} />
      </div>
    </nav>
  );
}