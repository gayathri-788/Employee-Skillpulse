'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Spinner } from '@/components/spinner';
import { Switch } from '@/components/switch';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { useApiData } from '@/lib/use-api-data';
import { SCHEDULE_DAYS, SHIFT_OPTIONS, parseShiftData, normalizeShiftValue, type DayKey } from '@/lib/shift';
import {
  btnPrimary,
  btnSecondary,
  cx,
  panel,
  panelBody,
  panelHeader,
  pageHeaderRow,
  pageHeaderSubtitle,
  pageHeaderTitle,
  scheduleMetaItem,
  shiftDropdown,
} from '@/lib/ui';
import type { Employee, Schedule, ScheduleUpdatePayload } from '@/lib/types';

const schedViewCardBase = 'rounded-md overflow-hidden border transition-all duration-200';
const schedViewCardWorking = `${schedViewCardBase} border-[rgba(16,185,129,0.35)] bg-bg-tertiary`;
const schedViewCardOff = `${schedViewCardBase} border-border opacity-[0.88] bg-bg-tertiary/40`;
const schedViewCardHeader = 'flex items-center justify-between px-[18px] py-3.5 flex-wrap gap-2.5';
const schedDayDot = 'w-2.5 h-2.5 rounded-full shrink-0';
const schedDayDotOn = 'bg-success shadow-[0_0_6px_var(--success)]';
const schedDayDotOff = 'bg-text-muted';
const schedDayName = 'font-bold text-[1.05rem] text-text-primary tracking-[0.02em]';
const schedShiftBadge =
  'inline-flex items-center gap-1 text-[0.82rem] font-semibold text-info bg-[rgba(96,165,250,0.15)] border border-[rgba(96,165,250,0.3)] rounded-full px-2.5 py-0.5';
const schedStatusBadgeBase = 'text-[0.78rem] font-bold px-3 py-1 rounded-[20px] tracking-[0.03em] border';
const schedStatusBadgeWorking = `${schedStatusBadgeBase} bg-bg-success-glow text-success border-border-success`;
const schedStatusBadgeOff = `${schedStatusBadgeBase} bg-bg-tertiary text-text-secondary border-border`;
const schedViewTasks = 'px-[18px] pt-3 pb-3.5 border-t border-border flex flex-col gap-2';
const schedTaskRow = 'flex items-start gap-2 text-[0.92rem] font-medium text-text-primary leading-[1.45]';

type EditState = {
  working: Record<DayKey, boolean>;
  shift: Record<DayKey, string>;
  tasks: Record<DayKey, string>;
};

function editStateFromSchedule(sched: Schedule): EditState {
  const shift = parseShiftData(sched.shift);
  const working = {} as Record<DayKey, boolean>;
  const tasks = {} as Record<DayKey, string>;
  for (const { key, tasksKey } of SCHEDULE_DAYS) {
    working[key] = sched[key] === 'Working';
    tasks[key] = sched[tasksKey] || '';
  }
  return { working, shift, tasks };
}

export default function SchedulePage() {
  const { authedFetch } = useAuth();
  const { showToast } = useToast();
  const { data: schedule, setData: setSchedule, loading: schedLoading } = useApiData<Schedule>('/api/schedule/me');
  const { data: profile, loading: profileLoading } = useApiData<Employee>('/api/employees/me');

  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [expandedDay, setExpandedDay] = useState<DayKey | null>(null);
  const [saving, setSaving] = useState(false);

  const loading = schedLoading || profileLoading;

  function startEdit() {
    if (!schedule) return;
    setEdit(editStateFromSchedule(schedule));
    setExpandedDay(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEdit(null);
  }

  function toggleWorking(day: DayKey) {
    setEdit((prev) => {
      if (!prev) return prev;
      const nowWorking = !prev.working[day];
      if (nowWorking) setExpandedDay(day);
      return { ...prev, working: { ...prev.working, [day]: nowWorking } };
    });
  }

  async function handleSave() {
    if (!edit || !schedule) return;
    setSaving(true);
    const payload: ScheduleUpdatePayload = {
      monday: edit.working.monday ? 'Working' : 'Off',
      tuesday: edit.working.tuesday ? 'Working' : 'Off',
      wednesday: edit.working.wednesday ? 'Working' : 'Off',
      thursday: edit.working.thursday ? 'Working' : 'Off',
      friday: edit.working.friday ? 'Working' : 'Off',
      shift: JSON.stringify(edit.shift),
      monday_tasks: edit.tasks.monday,
      tuesday_tasks: edit.tasks.tuesday,
      wednesday_tasks: edit.tasks.wednesday,
      thursday_tasks: edit.tasks.thursday,
      friday_tasks: edit.tasks.friday,
      notes: schedule.notes,
    };
    try {
      const updated = await authedFetch<Schedule>(`/api/schedule/${schedule.employee_id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setSchedule(updated);
      showToast('✅ Schedule and tasks saved!', 'success');
      setEditing(false);
      setEdit(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  const workingCount = schedule ? SCHEDULE_DAYS.filter((d) => schedule[d.key] === 'Working').length : 0;
  const editWorkingCount = edit ? SCHEDULE_DAYS.filter((d) => edit.working[d.key]).length : 0;
  const shiftData = schedule ? parseShiftData(schedule.shift) : null;

  return (
    <>
      <div className={pageHeaderRow}>
        <div>
          <h1 className={pageHeaderTitle}>My Weekly Schedule</h1>
          <p className={pageHeaderSubtitle}>Your work schedule Monday – Friday based on your project assignment.</p>
        </div>
        {!editing && schedule && (
          <button className={btnPrimary} onClick={startEdit}>
            <span className="material-icons-round">edit_calendar</span>
            <span>Edit Schedule</span>
          </button>
        )}
      </div>

      {loading && (
        <div className="text-center flex flex-col items-center gap-3 py-[60px]">
          <Spinner />
          Loading schedule…
        </div>
      )}

      {!loading && schedule && !editing && (
        <>
          <div className={cx(panel, '!mb-5')}>
            <div className="px-5 py-4">
              <div className="flex flex-wrap gap-5 items-center justify-between">
                <div className="flex gap-4 flex-wrap items-center">
                  <div className={scheduleMetaItem}>
                    <span className="material-icons-round">folder_open</span>
                    <span>
                      Project: <strong>{profile?.project_name || 'Bench'}</strong>
                    </span>
                  </div>
                  <div className={scheduleMetaItem}>
                    <span className="material-icons-round">person</span>
                    <span>
                      Manager: <strong>{schedule.manager_name || 'Not assigned'}</strong>
                    </span>
                  </div>
                  <div className={scheduleMetaItem}>
                    <span className="material-icons-round">event_available</span>
                    <span>
                      Working Days: <strong>{workingCount} / 5</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {SCHEDULE_DAYS.map((d) => {
              const isWorking = schedule[d.key] === 'Working';
              const taskValue = schedule[d.tasksKey] || '';
              const tasks = taskValue.split('\n').filter((t) => t.trim());
              const shiftLabel = shiftData ? shiftData[d.key] : '9 AM - 6 PM';
              return (
                <div key={d.key} className={isWorking ? schedViewCardWorking : schedViewCardOff}>
                  <div className={schedViewCardHeader}>
                    <div className="flex items-center gap-3">
                      <div className={cx(schedDayDot, isWorking ? schedDayDotOn : schedDayDotOff)} />
                      <span className={schedDayName}>{d.label}</span>
                    </div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {isWorking && (
                        <span className={schedShiftBadge}>
                          <span className="material-icons-round text-sm align-middle">schedule</span>
                          {shiftLabel}
                        </span>
                      )}
                      <span className={isWorking ? schedStatusBadgeWorking : schedStatusBadgeOff}>{isWorking ? 'Working' : 'Off'}</span>
                    </div>
                  </div>
                  {isWorking && tasks.length > 0 && (
                    <div className={schedViewTasks}>
                      {tasks.map((t, i) => (
                        <div className={schedTaskRow} key={i}>
                          <span className="material-icons-round text-sm text-accent-secondary">task_alt</span>
                          <span>{t.trim().replace(/^[•\-*]\s*/, '')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {isWorking && tasks.length === 0 && (
                    <div className={cx(schedViewTasks, 'text-text-secondary text-[0.85rem] italic')}>No tasks set for this day.</div>
                  )}
                </div>
              );
            })}
          </div>

          {schedule.notes && (
            <div className={cx(panel, 'mt-5')}>
              <div className={panelHeader}>
                <span className="material-icons-round">notes</span>
                <h2>Notes</h2>
              </div>
              <div className={cx(panelBody, 'text-[0.9rem] text-text-secondary whitespace-pre-wrap')}>{schedule.notes}</div>
            </div>
          )}
        </>
      )}

      {!loading && schedule && editing && edit && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div className={cx(panel, '!mb-5')}>
            <div className="px-5 py-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className={scheduleMetaItem}>
                  <span className="material-icons-round">folder_open</span>
                  <span>
                    Project: <strong>{profile?.project_name || 'Bench'}</strong>
                  </span>
                </div>
                <div className={scheduleMetaItem}>
                  <span className="material-icons-round">person</span>
                  <span>
                    Manager: <strong>{schedule.manager_name || 'Not assigned'}</strong>
                  </span>
                </div>
                <div className={scheduleMetaItem}>
                  <span className="material-icons-round">event_available</span>
                  <span>
                    Working Days: <strong>{editWorkingCount} / 5</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-accent-glow border border-[rgba(16,185,129,0.18)] rounded-md px-4 py-2.5 mb-[18px] flex items-center gap-2.5">
            <span className="material-icons-round text-accent-secondary text-[1.125rem]">info</span>
            <span className="text-sm text-text-secondary">
              Toggle days <strong>on/off</strong>, choose a shift from the dropdown, and add tasks. Click a day to expand. Hit{' '}
              <strong>Save</strong> when done.
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {SCHEDULE_DAYS.map((d) => {
              const isWorking = edit.working[d.key];
              const isOpen = expandedDay === d.key;
              const tasks = edit.tasks[d.key].split('\n').filter((t) => t.trim());
              return (
                <div
                  key={d.key}
                  className={cx(
                    'rounded-md overflow-hidden border',
                    isWorking ? 'border-[rgba(16,185,129,0.3)] bg-accent-glow' : 'border-border bg-white/[0.01]',
                  )}
                >
                  <div
                    className="flex items-center justify-between px-[18px] py-3.5 cursor-pointer select-none bg-black/10"
                    onClick={() => setExpandedDay(isOpen ? null : d.key)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cx(
                          'w-9 h-9 rounded-full flex items-center justify-center',
                          isWorking ? 'bg-[rgba(16,185,129,0.2)]' : 'bg-black/5',
                        )}
                      >
                        <span className={cx('material-icons-round text-[1.125rem]', isWorking ? 'text-accent-secondary' : 'text-text-muted')}>
                          {isWorking ? 'work' : 'weekend'}
                        </span>
                      </div>
                      <div>
                        <div className="font-bold text-base text-text-primary">{d.label}</div>
                        <span className="text-xs text-text-muted">
                          {isWorking ? (tasks.length > 0 ? `${tasks.length} task${tasks.length > 1 ? 's' : ''}` : 'No tasks yet') : 'Day off'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3.5">
                      <span
                        className={cx(
                          'text-[0.78rem] font-bold px-2.5 py-1 rounded-[20px] border',
                          isWorking
                            ? 'bg-[rgba(16,185,129,0.12)] text-[#10b981] border-[rgba(16,185,129,0.25)]'
                            : 'bg-black/5 text-text-muted border-border',
                        )}
                      >
                        {isWorking ? 'Working' : 'Off'}
                      </span>
                      <Switch checked={isWorking} onChange={() => toggleWorking(d.key)} onClick={(e) => e.stopPropagation()} />
                      <span
                        className={cx(
                          'material-icons-round text-text-muted transition-transform duration-[250ms] ease-in-out text-xl',
                          isWorking ? 'opacity-100' : 'opacity-40',
                          isOpen ? 'rotate-180' : 'rotate-0',
                        )}
                      >
                        expand_more
                      </span>
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-[18px] py-4 border-t border-border bg-black/5">
                          <div className={cx(isWorking ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-45')}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="material-icons-round text-base text-accent-secondary">schedule</span>
                              <label className="text-[0.82rem] font-semibold text-text-secondary !m-0">Shift Timing</label>
                            </div>
                            <select
                              className={shiftDropdown}
                              value={normalizeShiftValue(edit.shift[d.key])}
                              onChange={(e) =>
                                setEdit((prev) => (prev ? { ...prev, shift: { ...prev.shift, [d.key]: e.target.value } } : prev))
                              }
                            >
                              {SHIFT_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <label className="text-[0.82rem] font-semibold text-text-secondary flex items-center gap-1.5 mt-3.5 !mb-2">
                            <span className="material-icons-round text-base">checklist</span>
                            {d.label}&apos;s Tasks
                            <span className="font-normal text-text-muted text-[0.78rem]">(one task per line)</span>
                          </label>
                          <textarea
                            rows={4}
                            className="resize-y w-full font-[inherit] leading-relaxed box-border"
                            disabled={!isWorking}
                            value={edit.tasks[d.key]}
                            onChange={(e) =>
                              setEdit((prev) => (prev ? { ...prev, tasks: { ...prev.tasks, [d.key]: e.target.value } } : prev))
                            }
                          />
                          <div className="mt-2 flex justify-between items-center">
                            <span className="text-[0.73rem] text-text-muted">Enter each task on a new line</span>
                            <span className="text-[0.73rem] text-text-muted">{edit.tasks[d.key].length} chars</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end mt-6 gap-3">
            <button type="button" className={cx(btnSecondary, '!px-5 !py-2.5')} onClick={cancelEdit}>
              <span className="material-icons-round">close</span>
              <span>Cancel</span>
            </button>
            <button type="submit" className={cx(btnPrimary, '!px-6 !py-2.5 !text-base')} disabled={saving}>
              <span className="material-icons-round">save</span>
              <span>{saving ? 'Saving…' : 'Save Schedule & Tasks'}</span>
            </button>
          </div>
        </form>
      )}
    </>
  );
}
