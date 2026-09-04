import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import ConversationList from '@/components/marketplace/ConversationList';
import ChatWindow from '@/components/marketplace/ChatWindow';
import { markConversationRead } from '@/lib/messaging';

export default function Messages() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const activeId = params.get('c');

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => base44.entities.Conversation.list('-last_message_at', 100),
  });

  // Resolve the "other participant" for each conversation so we can show names/avatars.
  const otherIds = useMemo(
    () =>
      Array.from(
        new Set(conversations.map((c) => c.participant_ids.find((id) => id !== user.id)).filter(Boolean))
      ),
    [conversations, user.id]
  );
  const { data: users = [] } = useQuery({
    queryKey: ['msg-users', otherIds.join(',')],
    queryFn: () => Promise.all(otherIds.map((id) => base44.entities.User.get(id).catch(() => null))),
    enabled: otherIds.length > 0,
  });
  const userMap = {};
  users.forEach((u) => {
    if (u) userMap[u.id] = u;
  });

  const active = conversations.find((c) => c.id === activeId) || null;

  // Mark the open conversation as read.
  useEffect(() => {
    if (active) {
      markConversationRead(active, user).then(() => qc.invalidateQueries({ queryKey: ['conversations'] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Keep the conversation list fresh when new messages arrive.
  useEffect(() => {
    const unsub = base44.entities.Conversation.subscribe(() =>
      qc.invalidateQueries({ queryKey: ['conversations'] })
    );
    return unsub;
  }, [qc]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 font-display text-2xl font-semibold tracking-tight">Messages</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <div className={active ? 'hidden lg:block' : 'block'}>
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            userMap={userMap}
            me={user}
            onSelect={(id) => setParams({ c: id })}
          />
        </div>
        <div className={active ? 'block' : 'hidden lg:block'}>
          {active ? (
            <ChatWindow
              conversation={active}
              otherUser={userMap[active.participant_ids.find((id) => id !== user.id)]}
              me={user}
              onBack={() => setParams({})}
              onSent={() => qc.invalidateQueries({ queryKey: ['conversations'] })}
            />
          ) : (
            <div className="flex h-[70vh] items-center justify-center rounded-2xl border border-border/60 bg-card text-sm text-muted-foreground lg:h-[78vh]">
              Select a conversation to start chatting.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}