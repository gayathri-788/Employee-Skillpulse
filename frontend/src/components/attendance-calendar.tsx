import { attendanceCellClasses, attendanceTextClasses } from '@/lib/status';
import { cx } from '@/lib/ui';
import type { AttendanceRecordItem } from '@/lib/types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AttendanceCalendar({
  records,
  onDayClick,
}: {
  records: AttendanceRecordItem[];
  onDayClick?: (record: AttendanceRecordItem) => void;
}) {
  if (!records || records.length === 0) {
    return <div className="text-text-muted text-center py-6">No attendance records found.</div>;
  }

  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))' }}>
      {records.map((r) => {
        const d = new Date(`${r.date}T00:00:00`);
        return (
          <div
            key={r.id}
            className={cx(
              'relative flex flex-col items-center justify-center gap-1 py-3.5 px-2 rounded-md border bg-bg-card transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-md',
              onDayClick ? 'cursor-pointer hover:border-accent-primary' : 'cursor-default',
              attendanceCellClasses(r.status)
            )}
            title={r.notes ? `Note: ${r.notes}` : r.date}
            onClick={onDayClick ? () => onDayClick(r) : undefined}
          >
            <span className="text-[0.7rem] font-semibold text-text-muted uppercase tracking-[0.04em]">
              {String(d.getDate()).padStart(2, '0')} {d.toLocaleString('default', { month: 'short' })}
            </span>
            <span className="text-[0.65rem] text-text-muted">{WEEKDAYS[d.getDay()]}</span>
            <span className={cx('text-xl font-extrabold tracking-tight mt-0.5', attendanceTextClasses(r.status))}>{r.status}</span>
          </div>
        );
      })}
    </div>
  );
}
