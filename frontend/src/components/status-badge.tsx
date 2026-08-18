import { attendanceBadgeInfo } from '@/lib/status';
import { cx } from '@/lib/ui';

export function StatusBadge({ status }: { status: string }) {
  const info = attendanceBadgeInfo(status);
  return (
    <span
      className={cx(
        'inline-flex items-center justify-center min-w-[36px] px-2.5 py-1 rounded-full text-[0.8rem] font-bold tracking-[0.04em] border',
        info.classes
      )}
    >
      {info.label}
    </span>
  );
}
