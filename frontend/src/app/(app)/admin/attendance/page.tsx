'use client';

import { useState, type FormEvent } from 'react';
import { AttendanceCalendar } from '@/components/attendance-calendar';
import { Modal } from '@/components/modal';
import { Spinner } from '@/components/spinner';
import { StatusBadge } from '@/components/status-badge';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { useApiData } from '@/lib/use-api-data';
import { formatShiftSummary } from '@/lib/shift';
import {
  adminTable,
  btnIconOnly,
  btnPrimary,
  btnSecondary,
  cx,
  formGroup,
  pageHeaderRow,
  pageHeaderSubtitle,
  pageHeaderTitle,
  panel,
  panelBody,
  panelHeader,
} from '@/lib/ui';
import type { AttendanceData, AttendanceRecordItem, AttendanceStatus } from '@/lib/types';

interface OverviewRow {
  employee_id: string;
  name: string;
  project: string;
  today_status: AttendanceStatus;
  shift: string;
}

interface EditState {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  notes: string;
}

export default function AdminAttendancePage() {
  const { authedFetch } = useAuth();
  const { showToast } = useToast();
  const { data: overview, loading, refetch } = useApiData<OverviewRow[]>('/api/admin/attendance-overview');

  const [detail, setDetail] = useState<{ id: string; name: string; records: AttendanceRecordItem[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  async function viewDetail(empId: string, name: string) {
    setDetail({ id: empId, name, records: [] });
    setDetailLoading(true);
    try {
      const data = await authedFetch<AttendanceData>(`/api/attendance/${empId}`);
      setDetail({ id: empId, name, records: data.records.slice(0, 30) });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load attendance', 'error');
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshDetail(empId: string) {
    const data = await authedFetch<AttendanceData>(`/api/attendance/${empId}`);
    setDetail((prev) => (prev ? { ...prev, records: data.records.slice(0, 30) } : prev));
  }

  function openEdit(empId: string, record?: AttendanceRecordItem) {
    setEdit({
      employeeId: empId,
      date: record?.date || new Date().toISOString().slice(0, 10),
      status: record?.status || 'P',
      notes: record?.notes || '',
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    try {
      await authedFetch(`/api/attendance/${edit.employeeId}/record`, {
        method: 'POST',
        body: JSON.stringify({ date: edit.date, status: edit.status, notes: edit.notes || null, source: 'manual' }),
      });
      showToast('Attendance record saved!', 'success');
      setEdit(null);
      refetch();
      if (detail?.id === edit.employeeId) await refreshDetail(edit.employeeId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error saving record', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className={pageHeaderRow}>
        <div>
          <h1 className={pageHeaderTitle}>Attendance Tracker</h1>
          <p className={pageHeaderSubtitle}>View and manage attendance records for all employees.</p>
        </div>
      </div>

      <div className={panel}>
        <div className={panelHeader}>
          <span className="material-icons-round">today</span>
          <h2 className="flex items-center gap-2.5">
            Today&apos;s Attendance Overview
            <span className="text-[0.8rem] font-medium text-text-muted px-2.5 py-0.5 bg-bg-tertiary border border-border rounded-[20px]">
              {todayLabel}
            </span>
          </h2>
          <button className={cx(btnSecondary, btnIconOnly, 'ml-auto')} title="Refresh" onClick={() => refetch()}>
            <span className="material-icons-round">refresh</span>
          </button>
        </div>
        <div className={cx(panelBody, '!p-0')}>
          <div className="overflow-x-auto w-full">
            <table className={adminTable}>
              <thead>
                <tr>
                  <th>Emp ID</th>
                  <th>Name</th>
                  <th>Project</th>
                  <th>Shift</th>
                  <th>Today&apos;s Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="text-center py-10">
                      <div className="flex justify-center">
                        <Spinner />
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && (overview || []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-text-muted py-[30px]">
                      No employees found.
                    </td>
                  </tr>
                )}
                {!loading &&
                  overview?.map((row) => (
                    <tr key={row.employee_id}>
                      <td>
                        <strong>{row.employee_id}</strong>
                      </td>
                      <td>{row.name}</td>
                      <td>{row.project}</td>
                      <td>
                        <span className="font-semibold text-accent-secondary">{formatShiftSummary(row.shift)}</span>
                      </td>
                      <td>
                        <StatusBadge status={row.today_status} />
                      </td>
                      <td>
                        <button
                          className={cx(btnSecondary, btnIconOnly)}
                          title="View Full Attendance"
                          onClick={() => viewDetail(row.employee_id, row.name)}
                        >
                          <span className="material-icons-round">event_note</span>
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {detail && (
        <div className={panel}>
          <div className={panelHeader}>
            <span className="material-icons-round">person_search</span>
            <h2>{detail.name} — Attendance History</h2>
            <button className={cx(btnSecondary, btnIconOnly, 'ml-auto')} onClick={() => setDetail(null)}>
              <span className="material-icons-round">close</span>
            </button>
          </div>
          <div className={panelBody}>
            {detailLoading ? (
              <div className="flex justify-center py-5">
                <Spinner />
              </div>
            ) : (
              <AttendanceCalendar records={detail.records} onDayClick={(r) => openEdit(detail.id, r)} />
            )}
          </div>
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Update Attendance" size="sm">
        {edit && (
          <form onSubmit={handleSubmit}>
            <div className={formGroup}>
              <label htmlFor="admin-att-date">Date</label>
              <input
                type="date"
                id="admin-att-date"
                required
                value={edit.date}
                onChange={(e) => setEdit((prev) => (prev ? { ...prev, date: e.target.value } : prev))}
              />
            </div>
            <div className={formGroup}>
              <label htmlFor="admin-att-status">Attendance Status</label>
              <select
                id="admin-att-status"
                required
                value={edit.status}
                onChange={(e) => setEdit((prev) => (prev ? { ...prev, status: e.target.value as AttendanceStatus } : prev))}
              >
                <option value="P">P — Present</option>
                <option value="Ab">Ab — Absent</option>
                <option value="H">H — Holiday</option>
                <option value="L">L — Leave</option>
              </select>
            </div>
            <div className={formGroup}>
              <label htmlFor="admin-att-notes">Notes (optional)</label>
              <input
                type="text"
                id="admin-att-notes"
                placeholder="e.g. Medical leave"
                value={edit.notes}
                onChange={(e) => setEdit((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" className={btnSecondary} onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button type="submit" className={btnPrimary} disabled={saving}>
                <span className="material-icons-round">save</span>
                <span>{saving ? 'Saving…' : 'Save Record'}</span>
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
