export const TIMESHEET_DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
export type TimesheetDayKey = (typeof TIMESHEET_DAY_KEYS)[number];

export const TASK_OPTIONS: string[] = [];

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

/** Formats a Date as a YYYY-MM-DD string using its local calendar date (not UTC — toISOString() shifts the date in non-UTC timezones). */
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  const diff = d.getDate() - (day === 0 ? 6 : day - 1);
  d.setDate(diff);
  return toLocalDateStr(d);
}

export function currentWeekMonday(): string {
  return mondayOf(toLocalDateStr(new Date()));
}
