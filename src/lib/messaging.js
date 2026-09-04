import { base44 } from '@/api/base44Client';

// Find an existing 1:1 conversation between the current user and a seller about
// a specific listing, or create a new one. RLS guarantees only conversations the
// user is part of are returned, so this is safe to run client-side.
export async function getOrCreateConversation({ listing, user, sellerId }) {
  if (!listing?.id || !user?.id || !sellerId) throw new Error('Invalid conversation parameters.');
  if (sellerId === user.id) throw new Error('You cannot message yourself.');

  const existing = await base44.entities.Conversation.filter({ listing_id: listing.id }, '-last_message_at', 50);
  const match = (existing || []).find(
    (c) => c.participant_ids?.includes(user.id) && c.participant_ids?.includes(sellerId)
  );
  if (match) return match;

  const participant_ids = [user.id, sellerId];
  return base44.entities.Conversation.create({
    participant_ids,
    listing_id: listing.id,
    listing_title: listing.title || null,
    listing_image: listing.images?.[0] || null,
    last_message_preview: '',
    last_message_at: new Date().toISOString(),
    last_sender_id: user.id,
    unread_counts: { [user.id]: 0, [sellerId]: 0 },
  });
}

// Send a message and update the conversation's denormalized last-message + unread state.
export async function sendMessage(conversation, user, body) {
  const text = (body || '').trim();
  if (!text) throw new Error('Message cannot be empty.');
  if (!conversation?.id || !user?.id) throw new Error('Invalid conversation.');

  const otherIds = (conversation.participant_ids || []).filter((id) => id !== user.id);
  const unread_counts = { ...(conversation.unread_counts || {}) };
  otherIds.forEach((id) => {
    unread_counts[id] = (unread_counts[id] || 0) + 1;
  });

  await base44.entities.Message.create({
    conversation_id: conversation.id,
    sender_id: user.id,
    participant_ids: conversation.participant_ids,
    body: text,
    attachments: [],
  });

  await base44.entities.Conversation.update(conversation.id, {
    last_message_preview: text.slice(0, 140),
    last_message_at: new Date().toISOString(),
    last_sender_id: user.id,
    unread_counts,
  });
}

// Reset the current user's unread count for a conversation (called when opening it).
export async function markConversationRead(conversation, user) {
  if (!conversation?.id || !user?.id) return;
  const current = (conversation.unread_counts || {})[user.id] || 0;
  if (!current) return;
  const unread_counts = { ...(conversation.unread_counts || {}), [user.id]: 0 };
  await base44.entities.Conversation.update(conversation.id, { unread_counts });
}

// Sum of unread messages across all conversations for a user (for nav badge).
export function totalUnread(conversations, userId) {
  if (!conversations || !userId) return 0;
  return conversations.reduce((sum, c) => sum + ((c.unread_counts || {})[userId] || 0), 0);
}