import { cn } from '@/lib/utils';

// STÆSJ wordmark — the Æ is highlighted in the accent color so the brand is
// recognizable from color alone. Works in black/white/monochrome via the
// surrounding text color (text-foreground) and the accent Æ.
export function Wordmark({ className = '', sizeClass = 'text-2xl' }) {
  return (
    <span className={cn('font-display font-bold tracking-tight leading-none select-none', sizeClass, className)}>
      <span className="text-foreground">ST</span>
      <span className="text-accent">Æ</span>
      <span className="text-foreground">SJ</span>
    </span>
  );
}

// Compact square mark — the app icon. Orange rounded square with a black Æ.
export function LogoMark({ className = '', size = 36 }) {
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.6 }}
      className={cn(
        'inline-flex items-center justify-center rounded-lg bg-accent font-display font-bold text-accent-foreground leading-none',
        className
      )}
    >
      Æ
    </span>
  );
}

export default function Logo({ className = '', sizeClass = 'text-2xl' }) {
  return <Wordmark className={className} sizeClass={sizeClass} />;
}