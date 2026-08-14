'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/components/spinner';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import {
  TIMESHEET_DAY_KEYS,
  TASK_OPTIONS,
  isLeaveTaskOption,
  leaveBadgeClasses,
  formatMinutes,
  parseMinutes,
  getWeekLabelText,
  mondayOf,
  currentWeekMonday,
  type TimesheetDayKey,
} from '@/lib/timesheet';
import {
  adminTable,
  alertDanger,
  alertSuccess,
  alertWarning,
  badgeDanger,
  badgeDefault,
  badgeSuccess,
  badgeWarning,
  btnIconOnly,
  btnPrimary,
  btnSecondary,
  cx,
  panel,
  panelBody,
  panelHeader,
  pageHeaderRow,
  pageHeaderSubtitle,
  pageHeaderTitle,
} from '@/lib/ui';
import type { AttendanceStatus, Employee, TimesheetData, TimesheetRow } from '@/lib/types';

interface EditRow {
  key: string;
  id: number | null;
  clientProject: string;
  task: string;
  days: Record<TimesheetDayKey, string>;
}

let rowKeySeq = 0;
function newRowKey() {
  return `row-${++rowKeySeq}`;
}

function rowFromServer(row: TimesheetRow): EditRow {
  const days = {} as Record<TimesheetDayKey, string>;
  for (const d of TIMESHEET_DAY_KEYS) days[d] = row[d] ? formatMinutes(row[d]) : '';
  return { key: newRowKey(), id: row.id ?? null, clientProject: row.client_project || '', task: row.task || '', days };
}

function emptyRow(defaultProject: string): EditRow {
  const days = {} as Record<TimesheetDayKey, string>;
  for (const d of TIMESHEET_DAY_KEYS) days[d] = '';
  return { key: newRowKey(), id: null, clientProject: defaultProject, task: '', days };
}

type DayCellMode = { kind: 'attendance'; label: string } | { kind: 'leave'; label: string } | { kind: 'input' };

function dayCellMode(row: EditRow, day: TimesheetDayKey, attendance: Record<string, AttendanceStatus | undefined>): DayCellMode {
  const status = attendance[day] || 'P';
  if (status === 'Ab') return { kind: 'attendance', label: 'Absent' };
  if (status === 'L') return { kind: 'attendance', label: 'Leave' };
  if (status === 'H') return { kind: 'attendance', label: 'Holiday' };
  if (isLeaveTaskOption(row.task) && !row.days[day].trim()) return { kind: 'leave', label: row.task };
  return { kind: 'input' };
}

const tsInputBase =
  'w-full bg-[rgba(15,23,42,0.45)] border border-white/15 rounded-md px-3 py-1.5 text-white font-medium text-[0.85rem] transition-all duration-150 placeholder:text-white/60 focus:bg-[rgba(15,23,42,0.7)] focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(16,185,129,0.2)] focus:outline-none disabled:bg-white/5 disabled:border-transparent disabled:text-white/30 disabled:cursor-not-allowed';
const tsDayInput = `${tsInputBase} max-w-[80px] text-center mx-auto block`;
const tsQuickSelect = 'text-[0.8rem] px-2 py-1 rounded [&_option]:bg-[#17223b] [&_option]:text-white';
const tsRowTotalPill =
  'bg-[rgba(99,102,241,0.15)] text-[#818cf8] px-3 py-1.5 rounded-md font-bold text-[0.85rem] border border-[rgba(99,102,241,0.25)] inline-block min-w-[60px] text-center';
const tsDeleteBtn =
  'inline-flex items-center justify-center gap-2 rounded-md p-2.5 aspect-square cursor-pointer border transition-all duration-200 bg-transparent border-[rgba(239,68,68,0.25)] text-danger hover:bg-[rgba(239,68,68,0.15)] hover:border-danger hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed';

const STATUS_BADGE_CLASS: Record<string, string> = {
  Approved: badgeSuccess,
  Released: badgeWarning,
  Rejected: badgeDanger,
  Draft: badgeDefault,
};

export default function TimesheetPage() {
  const { authedFetch } = useAuth();
  const { showToast } = useToast();

  const [weekStart, setWeekStart] = useState(currentWeekMonday());
  const [data, setData] = useState<TimesheetData | null>(null);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [profile, setProfile] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [releasing, setReleasing] = useState(false);

  useEffect(() => {
    authedFetch<Employee>('/api/employees/me').then(setProfile).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const load = useCallback(
    async (week: string) => {
      setLoading(true);
      try {
        const result = await authedFetch<TimesheetData>(`/api/timesheet/me?week_start=${week}`);
        setData(result);
        const defaultProject = profile?.project_name || 'Bench';
        setRows(result.rows.length > 0 ? result.rows.map(rowFromServer) : [emptyRow(defaultProject)]);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to load timesheet', 'error');
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- authedFetch/showToast identity changes shouldn't refetch; profile read via closure is fine (default-project fallback only)
    [profile?.project_name]
  );

  // Fetch-on-mount/week-change: syncing React state with the server, the standard justified use of an effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    load(weekStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only week navigation should trigger a reload
  }, [weekStart]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const canEdit = data?.can_edit !== false;
  const attendance = useMemo(() => data?.attendance || {}, [data]);

  function updateRow(key: string, patch: Partial<EditRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function updateDay(key: string, day: TimesheetDayKey, value: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, days: { ...r.days, [day]: value } } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow(profile?.project_name || '')]);
  }

  function deleteRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  const totals = useMemo(() => {
    const colTotals: Record<TimesheetDayKey, number> = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0 };
    const rowTotals = new Map<string, number>();
    let grand = 0;
    for (const row of rows) {
      let rowTotal = 0;
      for (const day of TIMESHEET_DAY_KEYS) {
        const mode = dayCellMode(row, day, attendance);
        const mins = mode.kind === 'input' ? parseMinutes(row.days[day]) : 0;
        rowTotal += mins;
        colTotals[day] += mins;
      }
      rowTotals.set(row.key, rowTotal);
      grand += rowTotal;
    }
    return { colTotals, rowTotals, grand };
  }, [rows, attendance]);

  const overLimit = totals.grand > 2700;

  async function handleSave(silent = false) {
    setSaving(true);
    const payload = {
      week_start: weekStart,
      rows: rows
        .filter((r) => r.clientProject.trim() || r.task.trim() || TIMESHEET_DAY_KEYS.some((d) => r.days[d].trim()))
        .map((r) => ({
          id: r.id,
          client_project: r.clientProject.trim() || 'General',
          task: r.task.trim() || 'Work',
          monday: parseMinutes(r.days.monday),
          tuesday: parseMinutes(r.days.tuesday),
          wednesday: parseMinutes(r.days.wednesday),
          thursday: parseMinutes(r.days.thursday),
          friday: parseMinutes(r.days.friday),
        })),
    };
    try {
      const result = await authedFetch<TimesheetData>('/api/timesheet/me/save', { method: 'POST', body: JSON.stringify(payload) });
      setData(result);
      setRows(result.rows.length > 0 ? result.rows.map(rowFromServer) : [emptyRow(profile?.project_name || 'Bench')]);
      if (!silent) showToast('Timesheet saved successfully!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save timesheet', 'error');
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleRelease() {
    if (!confirm('Are you sure you want to RELEASE your timesheet to Admin? Once released, your timesheet will be locked until Admin reviews it.'))
      return;
    setReleasing(true);
    try {
      await handleSave(true);
      const result = await authedFetch<TimesheetData>(`/api/timesheet/me/release?week_start=${weekStart}`, { method: 'POST' });
      setData(result);
      setRows(result.rows.length > 0 ? result.rows.map(rowFromServer) : [emptyRow(profile?.project_name || 'Bench')]);
      showToast('Timesheet released successfully to Admin!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to release timesheet', 'error');
    } finally {
      setReleasing(false);
    }
  }

  async function handleCopyPrevious() {
    try {
      const result = await authedFetch<TimesheetData>(`/api/timesheet/me/copy-previous?week_start=${weekStart}`, { method: 'POST' });
      setData(result);
      setRows(result.rows.length > 0 ? result.rows.map(rowFromServer) : [emptyRow(profile?.project_name || 'Bench')]);
      showToast('Copied previous week structure successfully!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to copy', 'error');
    }
  }

  const status = data?.status || 'Draft';
  const dayHeaders = useMemo(() => {
    const monday = new Date(`${weekStart}T00:00:00`);
    return TIMESHEET_DAY_KEYS.map((key, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { key, name: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i], label: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) };
    });
  }, [weekStart]);

  return (
    <>
      <div className={pageHeaderRow}>
        <div>
          <h1 className={pageHeaderTitle}>Weekly Timesheet</h1>
          <p className={pageHeaderSubtitle}>Log and track your weekly project hours, client assignments, and tasks.</p>
        </div>
      </div>

      <div className={panel}>
        <div className={cx(panelHeader, 'justify-between w-full flex-wrap')}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="material-icons-round">schedule</span>
            <h2>Weekly Timesheet</h2>
            <span className={cx(STATUS_BADGE_CLASS[status] || badgeDefault, '!text-[0.85rem] ml-2')}>
              {status === 'Released' ? 'Released (Pending Admin Review)' : status}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto">
            <button className={cx(btnSecondary, btnIconOnly)} title="Previous Week" onClick={() => setWeekStart(mondayOf(shiftDate(weekStart, -7)))}>
              <span className="material-icons-round">chevron_left</span>
            </button>
            <span className="font-medium text-[0.95rem] flex-1 sm:flex-initial sm:min-w-[180px] text-center">{getWeekLabelText(weekStart)}</span>
            <button className={cx(btnSecondary, btnIconOnly)} title="Next Week" onClick={() => setWeekStart(mondayOf(shiftDate(weekStart, 7)))}>
              <span className="material-icons-round">chevron_right</span>
            </button>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => e.target.value && setWeekStart(mondayOf(e.target.value))}
              className="w-full sm:w-auto sm:max-w-[150px]"
            />
          </div>
        </div>
        <div className={panelBody}>
          {!canEdit && (status === 'Approved' || status === 'Released') && (
            <div className={cx(status === 'Approved' ? alertSuccess : alertWarning, 'mb-4')}>
              <strong className="flex items-center gap-1">
                <span className="material-icons-round">{status === 'Approved' ? 'check_circle' : 'lock'}</span>
                Timesheet {status}:
              </strong>
              {status === 'Approved'
                ? 'Your timesheet for this week has been accepted and approved by Admin. Controls are locked.'
                : 'Your timesheet has been submitted to Admin for review. Editing is temporarily locked.'}
            </div>
          )}
          {canEdit && status === 'Rejected' && (
            <div className={cx(alertDanger, 'mb-4')}>
              <strong className="flex items-center gap-1">
                <span className="material-icons-round">warning</span>
                Timesheet Rejected:
              </strong>
              Admin has rejected your timesheet submission. Please review your hours/tasks and click <strong>Release Timesheet</strong> again when
              ready.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className={cx(adminTable, 'min-w-[800px] [&_tbody_td]:!px-3 [&_tbody_td]:!py-2.5 [&_tbody_td]:align-middle')} id="timesheet-table">
              <thead>
                <tr>
                  <th className="w-[25%]">Client &amp; Project</th>
                  <th className="w-[25%]">Task</th>
                  {dayHeaders.map((h) => (
                    <th key={h.key} className="text-center w-[8%]">
                      {h.name}
                      <br />
                      <span className="text-[0.7rem] font-normal normal-case text-text-muted">{h.label}</span>
                    </th>
                  ))}
                  <th className="text-center w-[10%]">Total</th>
                  <th className="w-[8%] text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center p-10">
                      <div className="flex flex-col items-center gap-3">
                        <Spinner />
                        Loading timesheet…
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.key}>
                      <td className="min-w-[210px]">
                        <div className="flex flex-col gap-1.5">
                          <input
                            type="text"
                            className={tsInputBase}
                            placeholder="Type or edit project name..."
                            value={row.clientProject}
                            disabled={!canEdit}
                            onChange={(e) => updateRow(row.key, { clientProject: e.target.value })}
                          />
                          <select
                            className={tsQuickSelect}
                            disabled={!canEdit}
                            value=""
                            onChange={(e) => e.target.value && updateRow(row.key, { clientProject: e.target.value })}
                          >
                            <option value="">-- Quick Select --</option>
                            <option value="Bench">Bench</option>
                          </select>
                        </div>
                      </td>
                      <td className="min-w-[210px]">
                        <div className="flex flex-col gap-1.5">
                          <input
                            type="text"
                            className={tsInputBase}
                            placeholder="Type task or role description..."
                            value={row.task}
                            disabled={!canEdit}
                            onChange={(e) => updateRow(row.key, { task: e.target.value })}
                          />
                          <select
                            className={tsQuickSelect}
                            disabled={!canEdit}
                            value=""
                            onChange={(e) => e.target.value && updateRow(row.key, { task: e.target.value })}
                          >
                            <option value="">-- Select Leave / Activity --</option>
                            {TASK_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      {TIMESHEET_DAY_KEYS.map((day) => {
                        const mode = dayCellMode(row, day, attendance);
                        if (mode.kind === 'attendance' || mode.kind === 'leave') {
                          return (
                            <td key={day} className="text-center">
                              <div className="flex justify-center items-center h-8">
                                <span
                                  className={cx(
                                    'inline-flex items-center justify-center px-3.5 py-1.5 text-[0.75rem] font-semibold uppercase tracking-wide rounded-md min-w-[92px] whitespace-nowrap text-center shadow-sm border',
                                    leaveBadgeClasses(mode.label),
                                  )}
                                  title={mode.label}
                                >
                                  {mode.label}
                                </span>
                              </div>
                            </td>
                          );
                        }
                        return (
                          <td key={day}>
                            <input
                              type="text"
                              className={tsDayInput}
                              placeholder="hh:mm"
                              value={row.days[day]}
                              disabled={!canEdit}
                              onChange={(e) => updateDay(row.key, day, e.target.value)}
                            />
                          </td>
                        );
                      })}
                      <td className="text-center !text-white !font-semibold">
                        <span className={tsRowTotalPill}>{formatMinutes(totals.rowTotals.get(row.key) || 0)}</span>
                      </td>
                      <td className="text-center">
                        <button className={tsDeleteBtn} title="Delete Row" disabled={!canEdit} onClick={() => deleteRow(row.key)}>
                          <span className="material-icons-round text-[1.1rem]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="font-semibold bg-bg-tertiary">
                  <td colSpan={2} className="text-right pr-5">
                    Total
                  </td>
                  {TIMESHEET_DAY_KEYS.map((day) => (
                    <td key={day} className="text-center">
                      {formatMinutes(totals.colTotals[day])}
                    </td>
                  ))}
                  <td className={cx('text-center', overLimit ? 'text-danger' : 'text-accent-primary')}>{formatMinutes(totals.grand)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center mt-5 gap-3">
            <div className="flex flex-wrap gap-3">
              <button className={cx(btnSecondary, '!px-4 !py-2 flex-1 sm:flex-initial justify-center')} disabled={!canEdit} onClick={addRow}>
                <span className="material-icons-round text-xl">add</span> Add Row
              </button>
              <button
                className={cx(btnSecondary, '!px-4 !py-2 flex-1 sm:flex-initial justify-center')}
                disabled={!canEdit}
                onClick={handleCopyPrevious}
              >
                <span className="material-icons-round text-xl">content_copy</span> Copy Previous Week
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
              <span
                className={cx(
                  'text-[0.9rem] font-medium w-full text-center lg:w-auto lg:text-left',
                  overLimit ? 'text-danger' : totals.grand === 2700 ? 'text-success' : 'text-text-secondary',
                )}
              >
                Total: {formatMinutes(totals.grand)} / 45:00
              </span>
              <button
                className={cx(btnPrimary, '!px-[18px] !py-2 flex-1 sm:flex-initial justify-center')}
                disabled={!canEdit || overLimit || saving}
                onClick={() => handleSave(false)}
              >
                <span className="material-icons-round text-xl">save</span> {saving ? 'Saving...' : 'Save Timesheet'}
              </button>
              <button
                className="inline-flex flex-1 sm:flex-initial justify-center items-center gap-1.5 rounded-md px-[18px] py-2 text-sm font-medium cursor-pointer border border-accent-primary bg-accent-primary text-white transition-colors duration-150 hover:bg-accent-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!canEdit || releasing}
                onClick={handleRelease}
              >
                <span className="material-icons-round text-xl">send</span> {releasing ? 'Releasing...' : 'Release Timesheet'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
