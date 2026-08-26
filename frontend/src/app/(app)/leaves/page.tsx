'use client';

import { useState, type FormEvent } from 'react';
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
  btnPrimary,
  formGroup,
  gridTwo,
  pageHeaderRow,
  pageHeaderSubtitle,
  pageHeaderTitle,
  panel,
  panelBody,
  panelHeader,
} from '@/lib/ui';
import type { LeaveRequest } from '@/lib/types';

const STATUS_BADGE_CLASS: Record<LeaveRequest['status'], string> = {
  Approved: badgeSuccess,
  Rejected: badgeDanger,
  Pending: badgeWarning,
};

export default function LeaveRequestsPage() {
  const { authedFetch } = useAuth();
  const { showToast } = useToast();
  const { data: requests, loading, refetch } = useApiData<LeaveRequest[]>('/api/leaves/me');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) return;
    if (endDate < startDate) {
      showToast('End date cannot be before start date', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await authedFetch('/api/leaves', {
        method: 'POST',
        body: JSON.stringify({ start_date: startDate, end_date: endDate, reason: reason.trim() || null }),
      });
      showToast('Leave request submitted for admin approval.', 'success');
      setStartDate('');
      setEndDate('');
      setReason('');
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to submit leave request', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className={pageHeaderRow}>
        <div>
          <h1 className={pageHeaderTitle}>Leave Requests</h1>
          <p className={pageHeaderSubtitle}>
            Request leave for specific dates. Once approved by admin, those exact days are marked Leave in your attendance and timesheet —
            the rest of the week is unaffected.
          </p>
        </div>
      </div>

      <div className={panel}>
        <div className={panelHeader}>
          <span className="material-icons-round">beach_access</span>
          <h2>Request Leave</h2>
        </div>
        <div className={panelBody}>
          <form onSubmit={handleSubmit}>
            <div className={gridTwo}>
              <div className={formGroup}>
                <label htmlFor="leave-start">Start Date</label>
                <input id="leave-start" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className={formGroup}>
                <label htmlFor="leave-end">End Date</label>
                <input id="leave-end" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className={formGroup}>
              <label htmlFor="leave-reason">Reason (optional)</label>
              <input
                id="leave-reason"
                type="text"
                placeholder="e.g. Family function, medical appointment..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <button type="submit" className={btnPrimary} disabled={submitting}>
              <span className="material-icons-round">send</span>
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </form>
        </div>
      </div>

      <div className={panel}>
        <div className={panelHeader}>
          <span className="material-icons-round">history</span>
          <h2>My Requests</h2>
        </div>
        <div className={panelBody}>
          {loading ? (
            <div className="text-center flex flex-col items-center gap-3 py-10">
              <Spinner />
              Loading requests…
            </div>
          ) : !requests || requests.length === 0 ? (
            <div className="text-text-muted text-center py-10">No leave requests submitted yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className={adminTable}>
                <thead>
                  <tr>
                    <th>Start</th>
                    <th>End</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Requested On</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDate(r.start_date)}</td>
                      <td>{formatDate(r.end_date)}</td>
                      <td>{r.reason || '—'}</td>
                      <td>
                        <span className={STATUS_BADGE_CLASS[r.status]}>{r.status}</span>
                      </td>
                      <td>{formatDate(r.created_at)}</td>
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
