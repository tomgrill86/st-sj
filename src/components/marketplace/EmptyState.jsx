import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/** @param {{ icon?: React.ElementType; title: string; description?: string; actionLabel?: string; actionTo?: string }} props */
export default function EmptyState({ icon: Icon, title, description, actionLabel, actionTo }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {actionLabel && actionTo && (
        <Button asChild className="mt-6 bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to={actionTo}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}