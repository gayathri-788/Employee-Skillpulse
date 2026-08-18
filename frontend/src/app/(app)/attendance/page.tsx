'use client';

import { AttendanceCalendar } from '@/components/attendance-calendar';
import { Spinner } from '@/components/spinner';
import { useApiData } from '@/lib/use-api-data';
import {
  cx,
  pageHeaderRow,
  pageHeaderSubtitle,
  pageHeaderTitle,
  panel,
  panelBody,
  panelHeader,
  statCard,
  statIconAmber,
  statIconBlue,
  statIconGreen,
  statIconOrange,
  statIconRed,
  statIconWrapper,
  statInfo,
  statLabel,
  statNumber,
  statsRow,
} from '@/lib/ui';
import type { AttendanceData } from '@/lib/types';

export default function AttendancePage() {
  const { data, loading } = useApiData<AttendanceData>('/api/attendance/me');

  const records = data?.records || [];
  const counts = {
    P: records.filter((r) => r.status === 'P').length,
    WFH: records.filter((r) => r.status === 'WFH').length,
    Ab: records.filter((r) => r.status === 'Ab').length,
    H: records.filter((r) => r.status === 'H').length,
    L: records.filter((r) => r.status === 'L').length,
  };

  return (
    <>
      <div className={pageHeaderRow}>
        <div>
          <h1 className={pageHeaderTitle}>My Attendance</h1>
          <p className={pageHeaderSubtitle}>
            View your attendance records. Status codes: <strong className="text-success">P</strong> Present &nbsp;|&nbsp;{' '}
            <strong className="text-[#a855f7]">WFH</strong> WFH &nbsp;|&nbsp; <strong className="text-[#f87171]">Ab</strong> Absent
            &nbsp;|&nbsp; <strong className="text-[#38bdf8]">H</strong> Holiday &nbsp;|&nbsp; <strong className="text-[#fb923c]">L</strong>{' '}
            Leave
          </p>
        </div>
      </div>

      <div className={statsRow}>
        <div className={statCard}>
          <div className={cx(statIconWrapper, statIconGreen)}>
            <span className="material-icons-round">check_circle</span>
          </div>
          <div className={statInfo}>
            <span className={statLabel}>Present Days</span>
            <span className={statNumber}>{counts.P}</span>
          </div>
        </div>
        <div className={statCard}>
          <div className={cx(statIconWrapper, statIconAmber)}>
            <span className="material-icons-round">home</span>
          </div>
          <div className={statInfo}>
            <span className={statLabel}>WFH Days</span>
            <span className={statNumber}>{counts.WFH}</span>
          </div>
        </div>
        <div className={statCard}>
          <div className={cx(statIconWrapper, statIconRed)}>
            <span className="material-icons-round">cancel</span>
          </div>
          <div className={statInfo}>
            <span className={statLabel}>Absent Days</span>
            <span className={statNumber}>{counts.Ab}</span>
          </div>
        </div>
        <div className={statCard}>
          <div className={cx(statIconWrapper, statIconBlue)}>
            <span className="material-icons-round">wb_sunny</span>
          </div>
          <div className={statInfo}>
            <span className={statLabel}>Holidays / Off</span>
            <span className={statNumber}>{counts.H}</span>
          </div>
        </div>
        <div className={statCard}>
          <div className={cx(statIconWrapper, statIconOrange)}>
            <span className="material-icons-round">beach_access</span>
          </div>
          <div className={statInfo}>
            <span className={statLabel}>Leave Days</span>
            <span className={statNumber}>{counts.L}</span>
          </div>
        </div>
      </div>

      <div className={panel}>
        <div className={panelHeader}>
          <span className="material-icons-round">event_available</span>
          <h2>Last 30 Working Days</h2>
        </div>
        <div className={panelBody}>
          {loading ? (
            <div className="text-center flex flex-col items-center gap-3 p-10">
              <Spinner />
              Loading attendance…
            </div>
          ) : (
            <AttendanceCalendar records={records.slice(0, 30)} />
          )}
        </div>
      </div>
    </>
  );
}
