'use client';

import { useMemo, useState } from 'react';
import { Spinner } from '@/components/spinner';
import { useApiData } from '@/lib/use-api-data';
import { targetBadgeClasses } from '@/lib/status';
import {
  adminTable,
  cx,
  formGroup,
  lastUpdatedBadge,
  pageHeaderBadges,
  pageHeaderRow,
  pageHeaderSubtitle,
  pageHeaderTitle,
  panel,
  searchPanel,
  statCard,
  statIconGreen,
  statIconOrange,
  statIconWrapper,
  statInfo,
  statLabel,
  statNumber,
  statsRow,
} from '@/lib/ui';
import type { AdminSkillTargetOverviewItem } from '@/lib/types';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR - 1];

const overallBadgeBase =
  'inline-flex items-center justify-center px-3 py-1.5 text-[0.72rem] font-bold uppercase tracking-wide rounded-md min-w-[140px] text-center shadow-sm border';
const badgeOnpoint = `${overallBadgeBase} bg-[rgba(16,185,129,0.12)] text-[#10b981] border-[rgba(16,185,129,0.3)]`;
const badgePending = `${overallBadgeBase} bg-[rgba(245,158,11,0.12)] text-[#fbbf24] border-[rgba(245,158,11,0.3)]`;
const badgeNone = `${overallBadgeBase} bg-[rgba(156,163,175,0.12)] text-[#9ca3af] border-[rgba(156,163,175,0.3)]`;
const statIconGrey = 'bg-[rgba(156,163,175,0.12)] text-[#9ca3af]';
const projectBadge =
  'bg-bg-tertiary border border-border px-2.5 py-1 rounded-sm text-xs max-w-[140px] whitespace-nowrap overflow-hidden text-ellipsis inline-block';
const skillTargetLevelBadge =
  'inline-flex items-center px-2.5 py-1 rounded-full text-[0.72rem] font-semibold bg-bg-tertiary text-text-secondary border border-border';
const toggleDetailsBtn =
  'inline-flex items-center gap-1 bg-transparent border border-border text-text-primary px-2 py-1 text-[0.8rem] rounded cursor-pointer transition-all duration-200 hover:bg-white/5 hover:border-accent-secondary';
const detailsRow = 'bg-[rgba(30,41,59,0.4)]';
const detailsBox = 'px-6 py-4 border-l-4 border-accent-secondary';
const subtable = 'w-full border-collapse mt-2.5 [&_th]:text-xs [&_th]:uppercase [&_th]:text-text-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:border-b [&_th]:border-border [&_td]:text-[0.825rem] [&_td]:px-3 [&_td]:py-2 [&_td]:border-b [&_td]:border-white/5';

function overallBadgeClass(status: string): string {
  if (status === 'Target Completed' || status === 'Target is onpoint') return badgeOnpoint;
  if (status === 'In-Progress' || status === 'Pending') return badgePending;
  return badgeNone;
}

function targetDisplayStatus(status: string): string {
  return status === 'In Progress' || status === 'In-Progress' ? 'On-Going' : status;
}

export default function AdminSkillTargetsPage() {
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, loading } = useApiData<AdminSkillTargetOverviewItem[]>(`/api/admin/skilltargets-overview?year=${year}`);
  const items = useMemo(() => data || [], [data]);

  const stats = useMemo(
    () => ({
      total: items.length,
      onpoint: items.filter((i) => i.targets_status === 'Target Completed' || i.targets_status === 'Target is onpoint').length,
      pending: items.filter((i) => i.targets_status === 'In-Progress' || i.targets_status === 'Pending').length,
      none: items.filter((i) => i.targets_status === 'No Targets Set').length,
    }),
    [items]
  );

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return items.filter((item) => {
      const matchesSearch = !s || item.name.toLowerCase().includes(s) || item.employee_id.toLowerCase().includes(s);
      const matchesStatus =
        !statusFilter ||
        item.targets_status === statusFilter ||
        (statusFilter === 'Target Completed' && item.targets_status === 'Target is onpoint') ||
        (statusFilter === 'In-Progress' && (item.targets_status === 'Pending' || item.targets_status === 'In-Progress'));
      return matchesSearch && matchesStatus;
    });
  }, [items, search, statusFilter]);

  function toggle(empId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  }

  return (
    <>
      <div className={pageHeaderRow}>
        <div>
          <h1 className={pageHeaderTitle}>Employee Growth Targets</h1>
          <p className={pageHeaderSubtitle}>Monitor all employees&apos; skill targets, completion status, and dates.</p>
        </div>
        <div className={pageHeaderBadges}>
          <div className={lastUpdatedBadge}>
            <span>Total Employees: </span>
            <strong>{stats.total}</strong>
          </div>
        </div>
      </div>

      <div className={cx(statsRow, '!mb-6')}>
        <div className={statCard}>
          <div className={cx(statIconWrapper, statIconGreen)}>
            <span className="material-icons-round">check_circle</span>
          </div>
          <div className={statInfo}>
            <span className={statLabel}>Target Completed</span>
            <span className={statNumber}>{stats.onpoint}</span>
          </div>
        </div>
        <div className={statCard}>
          <div className={cx(statIconWrapper, statIconOrange)}>
            <span className="material-icons-round">trending_up</span>
          </div>
          <div className={statInfo}>
            <span className={statLabel}>In-Progress</span>
            <span className={statNumber}>{stats.pending}</span>
          </div>
        </div>
        <div className={statCard}>
          <div className={cx(statIconWrapper, statIconGrey)}>
            <span className="material-icons-round">rule</span>
          </div>
          <div className={statInfo}>
            <span className={statLabel}>No Targets Set</span>
            <span className={statNumber}>{stats.none}</span>
          </div>
        </div>
      </div>

      <div className={cx(searchPanel, '!mb-6')}>
        <div className="grid grid-cols-[1fr_180px_180px] gap-5 items-end max-[900px]:grid-cols-1">
          <div className={cx(formGroup, '!mb-0')}>
            <label htmlFor="admin-st-search-name">Search Employee Name / ID</label>
            <div className="relative">
              <span className="material-icons-round absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-xl">search</span>
              <input
                type="text"
                id="admin-st-search-name"
                placeholder="Name or Emp ID..."
                className="pl-11"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className={cx(formGroup, '!mb-0')}>
            <label htmlFor="admin-st-filter-status">Filter by Status</label>
            <select id="admin-st-filter-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Target Completed">Target Completed</option>
              <option value="In-Progress">In-Progress</option>
              <option value="No Targets Set">No Targets Set</option>
            </select>
          </div>
          <div className={cx(formGroup, '!mb-0')}>
            <label htmlFor="admin-st-filter-year">Year</label>
            <select id="admin-st-filter-year" value={year} onChange={(e) => setYear(e.target.value)}>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={panel}>
        <div className="overflow-x-auto w-full">
          <table className={adminTable}>
            <thead>
              <tr>
                <th>Emp ID</th>
                <th>Employee Name</th>
                <th>Project</th>
                <th>Overall Targets Status</th>
                <th className="w-[100px]">Targets</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="text-center py-10">
                    <div className="flex flex-col items-center gap-3">
                      <Spinner />
                      Loading employees&apos; skill targets...
                    </div>
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-text-muted">
                    No employees found matching the filters.
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((item) => {
                  const isOpen = expanded.has(item.employee_id);
                  return (
                    <>
                      <tr key={item.employee_id}>
                        <td>
                          <strong>{item.employee_id.toUpperCase()}</strong>
                        </td>
                        <td>{item.name}</td>
                        <td>
                          <span className={projectBadge}>{item.project_name}</span>
                        </td>
                        <td>
                          <span className={overallBadgeClass(item.targets_status)}>{item.targets_status}</span>
                        </td>
                        <td>
                          <button className={toggleDetailsBtn} onClick={() => toggle(item.employee_id)}>
                            <span className="material-icons-round text-base">{isOpen ? 'expand_less' : 'expand_more'}</span>
                            <span>
                              {isOpen ? 'Hide' : 'Show'} ({item.targets.length})
                            </span>
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className={detailsRow} key={`${item.employee_id}-details`}>
                          <td colSpan={5} className="!p-0">
                            <div className={detailsBox}>
                              <h3 className="text-[0.9rem] mb-2 text-text-primary">Target Skills Details for {item.name}</h3>
                              {item.targets.length === 0 ? (
                                <p className="text-text-muted italic m-0">No targets declared for this year.</p>
                              ) : (
                                <table className={subtable}>
                                  <thead>
                                    <tr>
                                      <th>Skill Name</th>
                                      <th>Target Level</th>
                                      <th>Start Date</th>
                                      <th>Target End Date</th>
                                      <th>Finished Date</th>
                                      <th>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {item.targets.map((t) => (
                                      <tr key={t.id}>
                                        <td>
                                          <strong>{t.skill_name}</strong>
                                        </td>
                                        <td>
                                          <span className={skillTargetLevelBadge}>{t.target_level || '—'}</span>
                                        </td>
                                        <td>{t.created_at ? new Date(t.created_at).toLocaleDateString('en-GB') : '—'}</td>
                                        <td>{t.target_completion_date ? new Date(`${t.target_completion_date}T00:00:00`).toLocaleDateString('en-GB') : '—'}</td>
                                        <td>{t.status === 'Completed' && t.updated_at ? new Date(t.updated_at).toLocaleDateString('en-GB') : '—'}</td>
                                        <td>
                                          <span
                                            className={cx(
                                              'inline-flex items-center px-2.5 py-1 rounded-full text-[0.72rem] font-bold tracking-wide uppercase',
                                              targetBadgeClasses(t.status),
                                            )}
                                          >
                                            {targetDisplayStatus(t.status)}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
