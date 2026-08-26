'use client';

import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/components/spinner';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { useApiData } from '@/lib/use-api-data';
import { formatDate } from '@/lib/format';
import { TIMESHEET_DAY_KEYS, formatMinutes, leaveBadgeClasses } from '@/lib/timesheet';
import { currentWeekMonday } from '@/lib/timesheet';
import {
  adminTable,
  badgeDanger,
  badgeDefault,
  badgeSuccess,
  badgeWarning,
  btnDanger,
  btnSecondary,
  btnSuccess,
  cx,
  formGroup,
  pageHeaderRow,
  pageHeaderSubtitle,
  pageHeaderTitle,
  panel,
  panelBody,
  panelHeader,
  searchPanel,
} from '@/lib/ui';
import type { AdminTimesheetListItem, AttendanceStatus, TimesheetData } from '@/lib/types';

const STATUS_BADGE_CLASS: Record<string, string> = {
  Approved: badgeSuccess,
  Released: badgeWarning,
  Rejected: badgeDanger,
  Draft: badgeDefault,
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function attendanceColorClass(status: AttendanceStatus): string {
  if (status === 'P') return 'text-success';
  if (status === 'Ab') return 'text-danger';
  if (status === 'L') return 'text-warning';
  return 'text-accent-primary';
}

export default function AdminTimesheetsPage() {
  const { authedFetch } = useAuth();
  const { showToast } = useToast();
  const [weekStart, setWeekStart] = useState(currentWeekMonday());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Released');

  const { data: list, loading, refetch } = useApiData<AdminTimesheetListItem[]>(`/api/admin/timesheets?week_start=${weekStart}`);
  const [details, setDetails] = useState<Record<string, TimesheetData | null>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [detailsLoading, setDetailsLoading] = useState(false);

  const filtered = useMemo(() => {
    const items = list || [];
    const s = search.toLowerCase().trim();
    return items.filter((item) => {
      const matchesSearch = !s || item.employee_id.toLowerCase().includes(s) || item.name.toLowerCase().includes(s);
      if (!matchesSearch) return false;
      if (statusFilter === 'Released') return item.status === 'Released';
      if (statusFilter === 'Approved') return item.status === 'Approved';
      if (statusFilter === 'Rejected') return item.status === 'Rejected';
      if (statusFilter === 'Draft') return item.status === 'Draft' || item.status === 'Not Released';
      return true;
    });
  }, [list, search, statusFilter]);

  // Fetch-on-filtered-list-change: syncing detail cards with the server.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (filtered.length === 0) {
      setDetails({});
      return;
    }
    let cancelled = false;
    setDetailsLoading(true);
    Promise.all(
      filtered.map((item) =>
        authedFetch<TimesheetData>(`/api/admin/timesheets/${item.employee_id}?week_start=${weekStart}`)
          .then((detail) => [item.employee_id, detail] as const)
          .catch(() => [item.employee_id, null] as const)
      )
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, TimesheetData | null> = {};
      const notesMap: Record<string, string> = {};
      for (const [id, detail] of results) {
        map[id] = detail;
        notesMap[id] = '';
      }
      setDetails(map);
      setNotes((prev) => ({ ...notesMap, ...prev }));
      setDetailsLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- authedFetch identity changes shouldn't refetch; keyed by filtered+weekStart
  }, [filtered, weekStart]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleReview(employeeId: string, action: 'accept' | 'reject') {
    const label = action === 'accept' ? 'ACCEPT & APPROVE' : 'REJECT';
    if (!confirm(`Are you sure you want to ${label} the timesheet for ${employeeId}?`)) return;
    try {
      await authedFetch(`/api/admin/timesheets/${employeeId}/review`, {
        method: 'PUT',
        body: JSON.stringify({ week_start: weekStart, action, notes: notes[employeeId] || '' }),
      });
      showToast(`Timesheet for ${employeeId} set to ${action === 'accept' ? 'Approved' : 'Rejected'}.`, 'success');
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed', 'error');
    }
  }

  const emptyText = useMemo(() => {
    if (statusFilter === 'Approved') return { header: 'No Approved Timesheets', desc: `No approved timesheets found for week starting ${weekStart}.` };
    if (statusFilter === 'Rejected') return { header: 'No Rejected Timesheets', desc: `No rejected timesheets found for week starting ${weekStart}.` };
    if (statusFilter !== 'Released')
      return { header: 'No Matching Timesheets', desc: `No employee timesheets found matching status "${statusFilter}" for week starting ${weekStart}.` };
    return {
      header: 'No Pending Approvals',
      desc: `No released timesheets awaiting approval for week starting ${weekStart}. When employees click "Release Timesheet" in their portal, their detailed timesheet cards will appear here for review.`,
    };
  }, [statusFilter, weekStart]);

  return (
    <>
      <div className={pageHeaderRow}>
        <div>
          <h1 className={pageHeaderTitle}>Employee Timesheet Approvals</h1>
          <p className={pageHeaderSubtitle}>
            Master submission roster for all employees across the organization. Review and approve released timesheets below.
          </p>
        </div>
      </div>

      <div className={cx(searchPanel, '!mb-6')}>
        <div className="grid grid-cols-[200px_1fr_220px_160px] gap-5 items-end max-[1100px]:grid-cols-2 max-[600px]:grid-cols-1">
          <div className={cx(formGroup, '!mb-0')}>
            <label htmlFor="admin-ts-week-picker">Select Week</label>
            <input type="date" id="admin-ts-week-picker" value={weekStart} onChange={(e) => e.target.value && setWeekStart(e.target.value)} />
          </div>
          <div className={cx(formGroup, '!mb-0')}>
            <label htmlFor="admin-ts-search-input">Search Employee</label>
            <input
              type="text"
              id="admin-ts-search-input"
              placeholder="Search by name or employee ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className={cx(formGroup, '!mb-0')}>
            <label htmlFor="admin-ts-status-filter">Timesheet Status Filter</label>
            <select id="admin-ts-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All Employees</option>
              <option value="Released">Pending Approval (Released)</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Draft">Draft / Not Released</option>
            </select>
          </div>
          <div className={cx(formGroup, '!mb-0 flex items-end')}>
            <button className={cx(btnSecondary, 'w-full')} onClick={() => refetch()}>
              <span className="material-icons-round">refresh</span> Refresh List
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {(loading || detailsLoading) && (
          <div className="text-center flex flex-col items-center gap-3 py-10">
            <Spinner />
            Loading timesheets...
          </div>
        )}

        {!loading && !detailsLoading && filtered.length === 0 && (
          <div className={cx(panel, 'py-12 px-6 text-center')}>
            <span className="material-icons-round text-[3.5rem] text-border mb-3 block">assignment_turned_in</span>
            <h3 className="m-0 mb-2 text-text-secondary text-[1.2rem]">{emptyText.header}</h3>
            <p className="m-0 text-text-muted text-sm leading-relaxed">{emptyText.desc}</p>
          </div>
        )}

        {!loading &&
          !detailsLoading &&
          filtered.map((emp) => {
            const detail = details[emp.employee_id];
            if (!detail) return null;

            const colTotals = [0, 0, 0, 0, 0];
            let grandTotal = 0;
            for (const r of detail.rows) {
              TIMESHEET_DAY_KEYS.forEach((day, idx) => {
                colTotals[idx] += r[day] || 0;
              });
              grandTotal += TIMESHEET_DAY_KEYS.reduce((sum, day) => sum + (r[day] || 0), 0);
            }

            return (
              <div className={cx(panel, '!mb-0')} key={emp.employee_id}>
                <div className={cx(panelHeader, 'justify-between flex-wrap gap-3 pb-3.5')}>
                  <div className="flex items-center gap-3">
                    <span className="material-icons-round text-[2rem] text-accent-primary">account_circle</span>
                    <div>
                      <h2 className="m-0 text-[1.1rem] flex items-center gap-2">
                        {emp.name}
                        <span className={cx(badgeDefault, '!text-[0.75rem]')}>{emp.employee_id}</span>
                      </h2>
                      <span className="text-[0.8rem] text-text-muted">
                        Project: <strong className="text-text-secondary">{emp.project_name || 'Bench'}</strong> | Released:{' '}
                        <strong>{emp.released_at ? formatDate(emp.released_at) : '—'}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cx(STATUS_BADGE_CLASS[emp.status] || badgeDefault, '!text-[0.85rem] !px-2.5 !py-1')}>
                      {emp.status === 'Released' ? 'Released (Pending Approval)' : emp.status}
                    </span>
                    <div className="text-[0.9rem] font-bold bg-bg-tertiary px-3 py-1 rounded-sm border border-border text-success">
                      Total: {emp.total_formatted || formatMinutes(grandTotal)}
                    </div>
                  </div>
                </div>

                <div className={cx(panelBody, '!px-5 !py-4')}>
                  <div className="mb-3.5 flex items-center justify-between flex-wrap gap-2 bg-bg-card px-3.5 py-2 rounded-sm border border-border">
                    <span className="text-[0.8rem] font-semibold text-text-secondary">Daily Attendance Status:</span>
                    <div className="flex gap-2 flex-wrap">
                      {TIMESHEET_DAY_KEYS.map((day, idx) => {
                        const st = detail.attendance[day] || 'P';
                        return (
                          <span
                            key={day}
                            className={cx('text-[0.75rem] px-1.5 py-0.5 rounded bg-white/[0.06] border border-border', attendanceColorClass(st))}
                          >
                            <strong>{DAY_LABELS[idx]}:</strong> {st}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className={cx(adminTable, 'min-w-[700px] !text-[0.88rem]')}>
                      <thead>
                        <tr>
                          <th className="w-[22%]">Client / Project</th>
                          <th className="w-[32%]">Task Description</th>
                          {DAY_LABELS.map((d) => (
                            <th key={d} className="w-[8%] text-center">
                              {d}
                            </th>
                          ))}
                          <th className="w-[8%] text-center">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.rows.length === 0 && (
                          <tr>
                            <td colSpan={8} className="text-center py-5 text-text-muted">
                              No task rows logged by employee.
                            </td>
                          </tr>
                        )}
                        {detail.rows.map((r, i) => {
                          const rowMins = TIMESHEET_DAY_KEYS.reduce((sum, day) => sum + (r[day] || 0), 0);
                          return (
                            <tr key={r.id ?? i}>
                              <td>
                                <strong>{r.client_project || 'Internal / Default'}</strong>
                              </td>
                              <td>{r.task || 'General Development / Support'}</td>
                              {TIMESHEET_DAY_KEYS.map((day) => {
                                const mins = r[day] || 0;
                                const st = detail.attendance[day] || 'P';
                                if (st === 'Ab' || st === 'L' || st === 'H') {
                                  const label = st === 'Ab' ? 'Absent' : st === 'L' ? 'Leave' : 'Holiday';
                                  return (
                                    <td key={day} className="text-center">
                                      <span className={cx('inline-flex items-center whitespace-nowrap px-3 py-1.5 rounded text-[0.72rem] border', leaveBadgeClasses(label))}>
                                        {label}
                                      </span>
                                    </td>
                                  );
                                }
                                return (
                                  <td key={day} className="text-center">
                                    {formatMinutes(mins)}
                                  </td>
                                );
                              })}
                              <td className="text-center font-semibold text-accent-secondary">{formatMinutes(rowMins)}</td>
                            </tr>
                          );
                        })}
                        <tr className="font-semibold bg-bg-tertiary">
                          <td colSpan={2} className="text-right text-[0.82rem] text-text-secondary">
                            Daily Totals:
                          </td>
                          {colTotals.map((t, i) => (
                            <td key={i} className="text-center">
                              {formatMinutes(t)}
                            </td>
                          ))}
                          <td className="text-center text-success text-[0.95rem]">{formatMinutes(grandTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border flex flex-col gap-3">
                    <div className={cx(formGroup, '!mb-0')}>
                      <label className="text-[0.8rem] font-semibold text-text-secondary">Admin Review Notes / Feedback (Optional):</label>
                      <input
                        type="text"
                        placeholder="e.g. Approved, or Please verify Thursday project hours..."
                        className="!text-[0.85rem]"
                        value={notes[emp.employee_id] ?? ''}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [emp.employee_id]: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-3 justify-end items-center">
                      <button
                        className={cx(btnDanger, '!px-4 !py-2', emp.is_past_month && '!opacity-55 !cursor-not-allowed')}
                        disabled={!emp.can_reject}
                        title={emp.is_past_month ? 'Timesheets from ended months cannot be rejected' : ''}
                        onClick={() => handleReview(emp.employee_id, 'reject')}
                      >
                        <span className="material-icons-round">{emp.is_past_month ? 'lock' : 'cancel'}</span>
                        <span>{emp.is_past_month ? 'Reject Disabled (Month Ended)' : 'Reject Timesheet'}</span>
                      </button>
                      <button className={cx(btnSuccess, '!px-4 !py-2')} disabled={!emp.can_accept} onClick={() => handleReview(emp.employee_id, 'accept')}>
                        <span className="material-icons-round">check_circle</span>
                        <span>Accept &amp; Approve</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </>
  );
}
