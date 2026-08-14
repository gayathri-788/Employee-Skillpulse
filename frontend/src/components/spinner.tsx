import { cx } from '@/lib/ui';

/** A loading spinner. `.spinner` was referenced throughout the app but never actually defined in CSS — this replaces it. */
export function Spinner({ className }: { className?: string }) {
  return <div className={cx('w-6 h-6 rounded-full border-2 border-border border-t-accent-primary animate-spin', className)} />;
}
