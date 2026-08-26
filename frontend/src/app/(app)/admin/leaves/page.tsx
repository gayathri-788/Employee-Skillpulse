'use client';

import { useMemo, useState } from 'react';
import { Spinner } from '@/components/spinner';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { useApiData } from '@/lib/use-api-data';
import { formatDate } from '@/lib/format';
import {
  adminTable,
  badgeDanger,
  badgeSuccess,
  badgeWarning,
  btnDanger,
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
import type { LeaveRequest } from '@/lib/types';

const STATUS_BADGE_CLASS: Record<LeaveRequest['status'], string> = {
  Approved: badgeSuccess,
  Rejected: badgeDanger,
  Pending: badgeWarning,
};

export default function AdminLeaveRequestsPage() {
  const { authedFetch } = useAuth();
  const { showToast } = useToast();
  const { data: requests, loading, refetch } = useApiData<LeaveRequest[]>('/api/admin/leaves');
  const [statusFilter, setStatusFilter] = useState<'Pending' | 'Approved' | 'Rejected' | 'ALL'>('Pending');
  const [actingId, setActingId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const items = requests || [];
    return statusFilter === 'ALL' ? items : items.filter((r) => r.status === statusFilter);
  }, [requests, statusFilter]);

  async function handleReview(id: number, status: 'Approved' | 'Rejected') {
    if (!confirm(`${status === 'Approved' ? 'Approve' : 'Reject'} this leave request? ${status === 'Approved' ? 'This will mark the requested days as Leave in attendance and timesheet.' : ''}`))
      return;
    setActingId(id);
    try {
      await authedFetch(`/api/admin/leaves/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
      showToast(`Leave request ${status.toLowerCase()}.`, 'success');
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed', 'error');
    } finally {
      setActingId(null);
    }
  }

  return (
    <>
      <div className={pageHeaderRow}>
        <div>
          <h1 className={pageHeaderTitle}>Leave Requests</h1>
          <p className={pageHeaderSubtitle}>Review employee leave requests. Approving syncs attendance and zeroes timesheet hours for exactly those days.</p>
        </div>
      </div>

      <div className={cx(searchPanel, '!mb-6')}>
        <div className={cx(formGroup, '!mb-0 max-w-[260px]')}>
          <label htmlFor="leave-status-filter">Status Filter</label>
          <select id="leave-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="ALL">All</option>
          </select>
        </div>
      </div>

      <div className={panel}>
        <div className={panelHeader}>
          <span className="material-icons-round">fact_check</span>
          <h2>Requests</h2>
        </div>
        <div className={panelBody}>
          {loading ? (
            <div className="text-center flex flex-col items-center gap-3 py-10">
              <Spinner />
              Loading requests…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-text-muted text-center py-10">No {statusFilter !== 'ALL' ? statusFilter.toLowerCase() : ''} leave requests.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className={adminTable}>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Requested On</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.employee_name} <span className="text-text-muted text-[0.8rem]">({r.employee_id})</span>
                      </td>
                      <td>{formatDate(r.start_date)}</td>
                      <td>{formatDate(r.end_date)}</td>
                      <td>{r.reason || '—'}</td>
                      <td>
                        <span className={STATUS_BADGE_CLASS[r.status]}>{r.status}</span>
                      </td>
                      <td>{formatDate(r.created_at)}</td>
                      <td>
                        <div className="flex gap-2 justify-center">
                          <button
                            className={cx(btnSuccess, '!px-3 !py-1.5')}
                            disabled={r.status !== 'Pending' || actingId === r.id}
                            onClick={() => handleReview(r.id, 'Approved')}
                          >
                            <span className="material-icons-round">check_circle</span>
                          </button>
                          <button
                            className={cx(btnDanger, '!px-3 !py-1.5')}
                            disabled={r.status !== 'Pending' || actingId === r.id}
                            onClick={() => handleReview(r.id, 'Rejected')}
                          >
                            <span className="material-icons-round">cancel</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
