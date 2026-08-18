'use client';

import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/components/spinner';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { formatDate } from '@/lib/format';
import { TIMESHEET_DAY_KEYS, currentWeekMonday, formatMinutes } from '@/lib/timesheet';
import {
  adminTable,
  badgeSuccess,
  btnDanger,
  btnSecondary,
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
import type { AdminTimesheetListItem, TimesheetData } from '@/lib/types';

type ApprovedEntry = AdminTimesheetListItem & { rows: TimesheetData['rows'] };

export default function AdminEmpTimesheetsPage() {
  const { authedFetch } = useAuth();
  const { showToast } = useToast();
  const [weekStart, setWeekStart] = useState(currentWeekMonday());
  const [search, setSearch] = useState('');
  const [list, setList] = useState<ApprovedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  // Fetch-on-week-change: syncing React state with the server.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const masterList = await authedFetch<AdminTimesheetListItem[]>(`/api/admin/timesheets?week_start=${weekStart}`);
        const approved = masterList.filter((item) => item.status === 'Approved');
        const full = await Promise.all(
          approved.map(async (emp) => {
            try {
              const data = await authedFetch<TimesheetData>(`/api/admin/timesheets/${emp.employee_id}?week_start=${weekStart}`);
              return { ...emp, rows: data.rows || [] };
            } catch {
              return { ...emp, rows: [] };
            }
          })
        );
        if (!cancelled) setList(full);
      } catch (err) {
        if (!cancelled) showToast(err instanceof Error ? err.message : 'Failed to load approved timesheets', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- authedFetch/showToast identity changes shouldn't refetch
  }, [weekStart, reloadTick]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return list;
    return list.filter((emp) => emp.employee_id.toLowerCase().includes(s) || emp.name.toLowerCase().includes(s));
  }, [list, search]);

  async function handleRevoke(emp: ApprovedEntry) {
    if (emp.is_past_month) return;
    const notes = prompt(`Reject approved timesheet for ${emp.name} (${emp.employee_id})?\nEnter optional rejection reason below:`, 'Rejection requested by Admin for corrections');
    if (notes === null) return;
    try {
      await authedFetch(`/api/admin/timesheets/${emp.employee_id}/review`, {
        method: 'PUT',
        body: JSON.stringify({ week_start: weekStart, action: 'reject', notes }),
      });
      showToast(`Timesheet for ${emp.employee_id} set to Rejected.`, 'success');
      setReloadTick((t) => t + 1);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed', 'error');
    }
  }

  return (
    <>
      <div className={pageHeaderRow}>
        <div>
          <h1 className={pageHeaderTitle}>Approved Employee Timesheets</h1>
          <p className={pageHeaderSubtitle}>Full row-by-row weekly timesheets approved by Admin for all employees.</p>
        </div>
      </div>

      <div className={cx(searchPanel, '!mb-6')}>
        <div className="grid grid-cols-[200px_1fr_140px] gap-5 items-end max-[900px]:grid-cols-1">
          <div className={cx(formGroup, '!mb-0')}>
            <label htmlFor="admin-tsdetail-week-picker">Select Week</label>
            <input type="date" id="admin-tsdetail-week-picker" value={weekStart} onChange={(e) => e.target.value && setWeekStart(e.target.value)} />
          </div>
          <div className={cx(formGroup, '!mb-0')}>
            <label htmlFor="admin-tsdetail-search-input">Search Approved Employee</label>
            <input
              type="text"
              id="admin-tsdetail-search-input"
              placeholder="Search by name or employee ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className={cx(formGroup, '!mb-0 flex items-end')}>
            <button className={cx(btnSecondary, 'w-full')} onClick={() => setReloadTick((t) => t + 1)}>
              <span className="material-icons-round">refresh</span> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {loading && (
          <div className="text-center flex flex-col items-center gap-3 py-10">
            <Spinner />
            Loading approved timesheets...
          </div>
        )}

        {!loading && list.length === 0 && (
          <div className={cx(panel, 'p-10 text-center text-text-muted')}>
            <span className="material-icons-round text-5xl text-text-muted mb-3 block">assignment_late</span>
            <h3>No Approved Timesheets Found</h3>
            <p className="text-text-secondary mt-2">
              There are no approved employee timesheets for week starting <strong>{weekStart}</strong>.
              <br />
              Timesheets will appear here once Admin accepts &amp; approves them in the <strong>Timesheet Approvals</strong> page.
            </p>
          </div>
        )}

        {!loading && list.length > 0 && filtered.length === 0 && (
          <div className={cx(panel, 'py-[30px] text-center text-text-muted')}>No approved employee timesheets match your search.</div>
        )}

        {!loading &&
          filtered.map((emp) => {
            const colTotals = [0, 0, 0, 0, 0];
            let grandTotal = 0;
            for (const r of emp.rows) {
              TIMESHEET_DAY_KEYS.forEach((day, idx) => {
                colTotals[idx] += r[day] || 0;
              });
              grandTotal += TIMESHEET_DAY_KEYS.reduce((sum, day) => sum + (r[day] || 0), 0);
            }

            return (
              <div className={panel} key={emp.employee_id}>
                <div className={cx(panelHeader, 'justify-between w-full')}>
                  <div className="flex items-center gap-3">
                    <span className="material-icons-round text-success">check_circle</span>
                    <h2>
                      {emp.name} ({emp.employee_id})
                    </h2>
                    <span className={badgeSuccess}>Approved</span>
                  </div>
                  <div className="text-[0.9rem] text-text-secondary">
                    Project: <strong className="text-text-primary">{emp.project_name || 'Bench'}</strong>
                  </div>
                </div>
                <div className={panelBody}>
                  <div className="mb-3 text-[0.88rem] text-text-secondary flex justify-between flex-wrap gap-3">
                    <span>
                      <strong>Week Start:</strong> {emp.week_start}
                    </span>
                    <span>
                      <strong>Released Timestamp:</strong> {emp.released_at ? formatDate(emp.released_at) : '—'}
                    </span>
                    <span>
                      <strong>Total Approved Hours:</strong> <strong className="text-success text-base">{formatMinutes(grandTotal)}</strong>
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className={cx(adminTable, 'min-w-[800px]')}>
                      <thead>
                        <tr>
                          <th className="w-[28%]">Client &amp; Project</th>
                          <th className="w-[28%]">Task</th>
                          <th className="text-center w-[8%]">Mon</th>
                          <th className="text-center w-[8%]">Tue</th>
                          <th className="text-center w-[8%]">Wed</th>
                          <th className="text-center w-[8%]">Thu</th>
                          <th className="text-center w-[8%]">Fri</th>
                          <th className="text-center w-[10%]">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {emp.rows.length === 0 && (
                          <tr>
                            <td colSpan={8} className="text-center py-5 text-text-muted">
                              No rows recorded.
                            </td>
                          </tr>
                        )}
                        {emp.rows.map((r, i) => {
                          const rowTot = TIMESHEET_DAY_KEYS.reduce((sum, day) => sum + (r[day] || 0), 0);
                          return (
                            <tr key={r.id ?? i}>
                              <td>
                                <strong>{r.client_project || 'General'}</strong>
                              </td>
                              <td>{r.task || 'Work'}</td>
                              {TIMESHEET_DAY_KEYS.map((day) => (
                                <td key={day} className="text-center">
                                  {formatMinutes(r[day] || 0)}
                                </td>
                              ))}
                              <td className="text-center">
                                <strong>{formatMinutes(rowTot)}</strong>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="font-semibold bg-bg-tertiary">
                          <td colSpan={2} className="text-right pr-5">
                            Total
                          </td>
                          {colTotals.map((t, i) => (
                            <td key={i} className="text-center">
                              {formatMinutes(t)}
                            </td>
                          ))}
                          <td className="text-center text-success">{formatMinutes(grandTotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="mt-3.5 pt-3.5 border-t border-border flex justify-between items-center flex-wrap gap-2.5">
                    <div className="text-[0.82rem] text-text-muted">
                      <span className="material-icons-round text-[15px] align-middle text-success">verified</span>
                      <span>
                        {emp.is_past_month
                          ? 'Archived past month timesheet (Read-only).'
                          : 'Approved for current month. Admin can reject when needed during this month.'}
                      </span>
                    </div>
                    <button
                      className={cx(btnDanger, '!px-3 !py-1.5 !text-[0.85rem]', emp.is_past_month && '!opacity-55 !cursor-not-allowed')}
                      disabled={emp.is_past_month}
                      title={emp.is_past_month ? 'Timesheets from ended months cannot be rejected' : 'Click to reject/revoke approval for corrections'}
                      onClick={() => handleRevoke(emp)}
                    >
                      <span className="material-icons-round text-[15px] align-middle">{emp.is_past_month ? 'lock' : 'cancel'}</span>
                      <span>{emp.is_past_month ? 'Locked (Month Ended)' : 'Reject / Revoke Approval'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </>
  );
}
