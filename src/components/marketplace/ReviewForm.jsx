import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import StarInput from './StarInput';
import { submitReview } from '@/lib/reviews';
import { userDisplayName } from '@/lib/marketplace';
import { toast } from '@/components/ui/use-toast';

export default function ReviewForm({ open, onOpenChange, seller, me }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const close = () => {
    if (saving) return;
    setRating(0);
    setBody('');
    onOpenChange(false);
  };

  const submit = async () => {
    if (!rating) {
      toast({ title: 'Please select a star rating.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await submitReview({ sellerId: seller.id, reviewerId: me.id, rating, body });
      qc.invalidateQueries({ queryKey: ['reviews', seller.id] });
      qc.invalidateQueries({ queryKey: ['my-review', seller.id, me.id] });
      toast({ title: 'Review posted', description: 'Thanks for your feedback!' });
      setRating(0);
      setBody('');
      onOpenChange(false);
    } catch (e) {
      toast({
        title: 'Could not post review',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review {userDisplayName(seller)}</DialogTitle>
          <DialogDescription>
            Share your experience to help other buyers. Your rating and comment are public.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Your rating</label>
            <StarInput value={rating} onChange={setRating} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Comment (optional)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="How was your experience with this seller?"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving || !rating}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {saving ? 'Posting…' : 'Post review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}