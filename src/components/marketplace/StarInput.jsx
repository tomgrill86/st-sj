import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

// Interactive star picker for selecting a 1–5 rating.
export default function StarInput({ value = 0, onChange, size = 28, className = '' }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div className={cn('inline-flex', className)} role="radiogroup" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="p-0.5 transition-transform hover:scale-110"
          aria-label={`${i} star${i > 1 ? 's' : ''}`}
          aria-pressed={value === i}
        >
          <Star
            style={{ width: size, height: size }}
            className={display >= i ? 'text-amber-400' : 'text-muted-foreground/30'}
            fill={display >= i ? 'currentColor' : 'none'}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}