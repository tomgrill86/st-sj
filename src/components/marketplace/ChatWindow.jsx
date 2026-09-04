import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { sendMessage } from '@/lib/messaging';
import { userDisplayName } from '@/lib/marketplace';

export default function ChatWindow({ conversation, otherUser, me, onBack, onSent }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', conversation.id],
    queryFn: () => base44.entities.Message.filter({ conversation_id: conversation.id }, 'created_date', 500),
  });

  // Live-update messages when new ones arrive in this conversation.
  useEffect(() => {
    const unsub = base44.entities.Message.subscribe((event) => {
      if (event?.data?.conversation_id === conversation.id) {
        qc.invalidateQueries({ queryKey: ['messages', conversation.id] });
      }
    });
    return unsub;
  }, [conversation.id, qc]);

  // Auto-scroll to the latest message.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(conversation, me, text);
      setText('');
      qc.invalidateQueries({ queryKey: ['messages', conversation.id] });
      onSent?.();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[70vh] flex-col rounded-2xl border border-border/60 bg-card lg:h-[78vh]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/60 p-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-9 w-9 border border-border">
          {otherUser?.avatar_url ? <AvatarImage src={otherUser.avatar_url} /> : null}
          <AvatarFallback className="bg-muted text-xs font-medium">
            {userDisplayName(otherUser).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{userDisplayName(otherUser)}</p>
          {conversation.listing_id && conversation.listing_title && (
            <Link
              to={`/listing/${conversation.listing_id}`}
              className="block truncate text-xs text-muted-foreground hover:underline"
            >
              Re: {conversation.listing_title}
            </Link>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.map((m) => {
          const mine = m.sender_id === me.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm ${
                  mine ? 'bg-accent text-accent-foreground' : 'bg-muted text-foreground'
                }`}
              >
                {m.body}
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No messages yet. Say hello!</p>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={submit} className="flex items-center gap-2 border-t border-border/60 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="h-11 flex-1 rounded-full border border-input bg-background px-4 text-sm outline-none focus:border-ring"
        />
        <Button
          type="submit"
          size="icon"
          disabled={sending || !text.trim()}
          className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}