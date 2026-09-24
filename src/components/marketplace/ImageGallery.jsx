import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Image } from '@/components/ui/image';

export default function ImageGallery({ images = [], title = '' }) {
  const [active, setActive] = useState(0);
  if (!images.length) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl border border-border bg-muted">
        <span className="font-display text-5xl font-bold text-muted-foreground/30">S</span>
      </div>
    );
  }
  const current = images[active];

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
        <Image src={current} alt={title} fittingType="fill" className="h-full w-full object-cover" />
        {images.length > 1 && (
          <>
            <button
              onClick={() => setActive((a) => (a - 1 + images.length) % images.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 shadow-sm backdrop-blur transition hover:bg-background"
              aria-label="Previous"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setActive((a) => (a + 1) % images.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 shadow-sm backdrop-blur transition hover:bg-background"
              aria-label="Next"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setActive(idx)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                idx === active ? 'border-ring' : 'border-transparent hover:border-border'
              }`}
            >
              <Image src={img} alt={`Thumbnail ${idx + 1}`} fittingType="fill" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}