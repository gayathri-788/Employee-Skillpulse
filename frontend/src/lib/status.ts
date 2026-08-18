/** Attendance day-cell container: border + tinted background per status. */
export function attendanceCellClasses(status: string): string {
  const map: Record<string, string> = {
    P: 'border-border-success bg-bg-success-glow',
    Ab: 'border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.06)]',
    H: 'border-[rgba(56,189,248,0.3)] bg-[rgba(56,189,248,0.06)]',
    L: 'border-[rgba(251,146,60,0.3)] bg-[rgba(251,146,60,0.06)]',
    WFH: 'border-[rgba(168,85,247,0.3)] bg-[rgba(168,85,247,0.06)]',
  };
  return map[status] || 'border-border';
}

/** Text color for the status label inside an attendance day-cell. */
export function attendanceTextClasses(status: string): string {
  const map: Record<string, string> = {
    P: 'text-success',
    Ab: 'text-[#f87171]',
    H: 'text-[#38bdf8]',
    L: 'text-[#fb923c]',
    WFH: 'text-[#a855f7]',
  };
  return map[status] || 'text-text-secondary';
}

/** Small pill badge (used in admin attendance overview table). */
export function attendanceBadgeInfo(status: string): { classes: string; label: string } {
  const map: Record<string, { classes: string; label: string }> = {
    P: { classes: 'bg-bg-success-glow text-success border-border-success', label: 'Present' },
    WFH: { classes: 'bg-[rgba(168,85,247,0.12)] text-[#a855f7] border-[rgba(168,85,247,0.25)]', label: 'WFH' },
    Ab: { classes: 'bg-[rgba(248,113,113,0.12)] text-[#f87171] border-[rgba(248,113,113,0.25)]', label: 'Absent' },
    L: { classes: 'bg-[rgba(251,146,60,0.12)] text-[#fb923c] border-[rgba(251,146,60,0.25)]', label: 'Leave' },
    H: { classes: 'bg-[rgba(56,189,248,0.12)] text-[#38bdf8] border-[rgba(56,189,248,0.25)]', label: 'Holiday' },
  };
  return (
    map[status] || (status === '—' || !status
      ? { classes: 'bg-[rgba(248,113,113,0.12)] text-[#f87171] border-[rgba(248,113,113,0.25)]', label: 'Absent' }
      : { classes: 'bg-white/5 text-text-muted border-border', label: status })
  );
}

/** Yearly skill target: top accent bar gradient. */
export function targetCardBarClasses(status: string): string {
  if (status === 'In Progress' || status === 'On-Going' || status === 'In-Progress') return 'from-[#f59e0b] to-[#fb923c]';
  if (status === 'Completed' || status === 'Target Completed') return 'from-[#34d399] to-[#0ea5e9]';
  return 'from-[#6366f1] to-[#8b5cf6]';
}

/** Yearly skill target: status pill badge. */
export function targetBadgeClasses(status: string): string {
  if (status === 'In Progress' || status === 'On-Going' || status === 'In-Progress')
    return 'bg-[rgba(245,158,11,0.15)] text-[#fbbf24] border-[rgba(245,158,11,0.3)]';
  if (status === 'Completed' || status === 'Target Completed') return 'bg-[rgba(52,211,153,0.15)] text-[#34d399] border-[rgba(52,211,153,0.3)]';
  return 'bg-[rgba(99,102,241,0.15)] text-[#818cf8] border-[rgba(99,102,241,0.3)]';
}
