export const SHIFT_OPTIONS = [
  { value: '6 AM - 3 PM', label: '6 AM – 3 PM  (Early Morning)' },
  { value: '7 AM - 4 PM', label: '7 AM – 4 PM  (Morning)' },
  { value: '8 AM - 5 PM', label: '8 AM – 5 PM  (Morning+)' },
  { value: '9 AM - 6 PM', label: '9 AM – 6 PM  (Day Shift)' },
  { value: '10 AM - 7 PM', label: '10 AM – 7 PM (Mid-Day)' },
  { value: '11 AM - 8 PM', label: '11 AM – 8 PM (Late Day)' },
  { value: '12 PM - 9 PM', label: '12 PM – 9 PM (Afternoon)' },
  { value: '1 PM - 10 PM', label: '1 PM – 10 PM  (Afternoon+)' },
  { value: '2 PM - 11 PM', label: '2 PM – 11 PM (Evening)' },
  { value: '4 PM - 1 AM', label: '4 PM – 1 AM  (Evening+)' },
  { value: '6 PM - 3 AM', label: '6 PM – 3 AM  (Night)' },
  { value: '8 PM - 5 AM', label: '8 PM – 5 AM  (Night+)' },
  { value: '10 PM - 7 AM', label: '10 PM – 7 AM (Night Shift)' },
  { value: '11 PM - 8 AM', label: '11 PM – 8 AM (Graveyard)' },
  { value: 'Flexible', label: 'Flexible Hours' },
] as const;

export function normalizeShiftValue(raw?: string | null): string {
  if (!raw) return '9 AM - 6 PM';
  if (SHIFT_OPTIONS.find((o) => o.value === raw)) return raw;
  const match = raw.match(/(\d+\s*(?:AM|PM))\s*[-–]\s*(\d+\s*(?:AM|PM))/i);
  if (match) return `${match[1].trim()} - ${match[2].trim()}`;
  if (raw.toLowerCase().includes('night')) return '10 PM - 7 AM';
  if (raw.toLowerCase().includes('afternoon')) return '2 PM - 11 PM';
  if (raw.toLowerCase().includes('flexible')) return 'Flexible';
  return '9 AM - 6 PM';
}

export type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';

export const SCHEDULE_DAYS: { key: DayKey; label: string; tasksKey: `${DayKey}_tasks` }[] = [
  { key: 'monday', label: 'Monday', tasksKey: 'monday_tasks' },
  { key: 'tuesday', label: 'Tuesday', tasksKey: 'tuesday_tasks' },
  { key: 'wednesday', label: 'Wednesday', tasksKey: 'wednesday_tasks' },
  { key: 'thursday', label: 'Thursday', tasksKey: 'thursday_tasks' },
  { key: 'friday', label: 'Friday', tasksKey: 'friday_tasks' },
];

/** Summarizes a possibly-per-day shift value: the common shift if all days match, else "Mixed Shifts". */
export function formatShiftSummary(shiftStr?: string | null): string {
  if (!shiftStr) return '9 AM - 6 PM';
  try {
    const data = JSON.parse(shiftStr) as Partial<Record<DayKey, string>>;
    const shifts = SCHEDULE_DAYS.map((d) => data[d.key] || '9 AM - 6 PM');
    const first = shifts[0];
    return shifts.every((s) => s === first) ? first : 'Mixed Shifts';
  } catch {
    return normalizeShiftValue(shiftStr);
  }
}

/** The `shift` column stores either a plain shift string (legacy) or a JSON map of day -> shift string. */
export function parseShiftData(shift?: string | null): Record<DayKey, string> {
  let data: Partial<Record<DayKey, string>> = {};
  try {
    data = JSON.parse(shift || '{}');
  } catch {
    const def = shift || '9 AM - 6 PM';
    data = { monday: def, tuesday: def, wednesday: def, thursday: def, friday: def };
  }
  const result = {} as Record<DayKey, string>;
  for (const { key } of SCHEDULE_DAYS) {
    result[key] = normalizeShiftValue(data[key] || '9 AM - 6 PM');
  }
  return result;
}
