import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StarRating({ value = 0, size = 14, showValue = false, className = '' }) {
  const rounded = Math.round((value || 0) * 2) / 2;
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className="flex">
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = rounded >= i ? 'full' : rounded >= i - 0.5 ? 'half' : 'empty';
          return (
            <Star
              key={i}
              style={{ width: size, height: size }}
              className={cn(
                'shrink-0',
                fill === 'empty' ? 'text-muted-foreground/30' : 'text-amber-400'
              )}
              fill={fill === 'empty' ? 'none' : 'currentColor'}
              strokeWidth={1.5}
            />
          );
        })}
      </span>
      {showValue && <span className="text-xs font-medium text-muted-foreground">{(value || 0).toFixed(1)}</span>}
    </span>
  );
}