import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { userDisplayName, timeAgo } from '@/lib/marketplace';

export default function ConversationList({ conversations, activeId, userMap, me, onSelect }) {
  if (!conversations || conversations.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-10 text-center text-sm text-muted-foreground">
        No conversations yet. Contact a seller from a listing to start chatting.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
      {conversations.map((c) => {
        const otherId = c.participant_ids.find((id) => id !== me.id);
        const other = userMap[otherId];
        const unread = (c.unread_counts || {})[me.id] || 0;
        const isActive = c.id === activeId;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`flex w-full items-center gap-3 p-3 text-left transition ${isActive ? 'bg-muted/50' : 'hover:bg-muted/30'}`}
          >
            <Avatar className="h-10 w-10 border border-border">
              {other?.avatar_url ? <AvatarImage src={other.avatar_url} /> : null}
              <AvatarFallback className="bg-muted text-xs font-medium">
                {userDisplayName(other).charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{userDisplayName(other)}</p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {c.last_message_at ? timeAgo(c.last_message_at) : ''}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs text-muted-foreground">
                  {c.last_message_preview || (c.listing_title ? `Re: ${c.listing_title}` : 'New conversation')}
                </p>
                {unread > 0 && (
                  <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
                    {unread}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}