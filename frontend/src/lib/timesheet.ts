export const TIMESHEET_DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
export type TimesheetDayKey = (typeof TIMESHEET_DAY_KEYS)[number];

export const TASK_OPTIONS = ['Sick Leave', 'Loss of Pay', 'Comp-off', 'Privilege Leave', 'WFH', 'Bereavement', 'Marriage Leave'];

const LEAVE_KEYWORDS = ['sick leave', 'loss of pay', 'comp-off', 'privilege leave', 'wfh', 'bereavement', 'marriage leave', 'leave', 'absent', 'holiday'];

export function isLeaveTaskOption(taskStr: string): boolean {
  if (!taskStr) return false;
  const str = taskStr.trim().toLowerCase();
  return LEAVE_KEYWORDS.some((k) => str.includes(k));
}

/** Tailwind classes for a leave/absence/holiday pill in a timesheet day cell. */
export function leaveBadgeClasses(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('absent')) return 'bg-[rgba(239,68,68,0.18)] text-[#f87171] border-[rgba(239,68,68,0.4)]';
  if (lower.includes('holiday')) return 'bg-[rgba(56,189,248,0.18)] text-[#38bdf8] border-[rgba(56,189,248,0.4)]';
  return 'bg-[rgba(245,158,11,0.18)] text-[#fbbf24] border-[rgba(245,158,11,0.4)]';
}

export function formatMinutes(mins: number): string {
  if (!mins || mins <= 0) return '0:00';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

export function parseMinutes(str: string): number {
  if (!str || str.trim() === '' || str === 'hh:mm') return 0;
  const parts = str.split(':');
  if (parts.length === 1) {
    const val = parseFloat(parts[0]);
    return isNaN(val) ? 0 : Math.round(val * 60);
  }
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export function getWeekLabelText(weekStartStr: string): string {
  const monday = new Date(`${weekStartStr}T00:00:00`);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `This week, ${monday.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
}

export function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  const diff = d.getDate() - (day === 0 ? 6 : day - 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

export function currentWeekMonday(): string {
  return mondayOf(new Date().toISOString().split('T')[0]);
}
