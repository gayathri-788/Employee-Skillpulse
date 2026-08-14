'use client';

import { useMemo, useState } from 'react';
import { Spinner } from '@/components/spinner';
import { useApiData } from '@/lib/use-api-data';
import {
  adminTable,
  btnSecondary,
  cx,
  formGroup,
  lastUpdatedBadge,
  pageHeaderBadges,
  pageHeaderRow,
  pageHeaderSubtitle,
  pageHeaderTitle,
  panel,
  searchBtnGroup,
  searchPanel,
} from '@/lib/ui';
import type { ClientAccount } from '@/lib/types';

const clientAccountPanel =
  'border border-[rgba(99,102,241,0.3)] rounded-2xl overflow-hidden bg-[rgba(15,23,42,0.85)] shadow-[0_8px_24px_rgba(0,0,0,0.3)]';
const clientAccountHeader =
  'px-6 py-5 bg-gradient-to-br from-[#1e293b] to-[#0f172a] border-b border-[rgba(99,102,241,0.25)] flex flex-wrap items-center justify-between gap-4';
const clientAccountIconBox =
  'w-[46px] h-[46px] rounded-xl bg-[rgba(99,102,241,0.2)] flex items-center justify-center border border-[rgba(99,102,241,0.4)]';
const pillBadge = 'text-[0.85rem] px-3.5 py-1.5 rounded-full font-bold inline-flex items-center gap-1.5 border';
const accountBadgeIndigo = `${pillBadge} bg-[rgba(99,102,241,0.18)] text-[#a5b4fc] border-[rgba(99,102,241,0.35)]`;
const accountBadgeGreen = `${pillBadge} bg-[rgba(52,211,153,0.18)] text-[#6ee7b7] border-[rgba(52,211,153,0.35)]`;
const projectCard =
  'border border-[rgba(148,163,184,0.25)] rounded-[14px] overflow-hidden bg-[#0f172a] shadow-[0_4px_16px_rgba(0,0,0,0.2)]';
const projectHeader = 'px-[22px] py-4 bg-[rgba(30,41,59,0.9)] border-b border-[rgba(148,163,184,0.2)] flex flex-wrap items-center justify-between gap-3.5';
const employeesAssignedBadge =
  'bg-[rgba(96,165,250,0.15)] text-[#93c5fd] border border-[rgba(96,165,250,0.3)] text-xs px-2.5 py-1 rounded-xl font-semibold';
const pmBadge =
  'text-[0.85rem] inline-flex items-center gap-1.5 bg-[rgba(168,85,247,0.18)] px-3.5 py-1.5 rounded-xl border border-[rgba(168,85,247,0.35)] text-[#e9d5ff] font-semibold';
const leadBadge =
  'text-[0.85rem] inline-flex items-center gap-1.5 bg-[rgba(245,158,11,0.18)] px-3.5 py-1.5 rounded-xl border border-[rgba(245,158,11,0.35)] text-[#fef3c7] font-semibold';
const projectTh = '!text-[#94a3b8] !text-[0.8rem] !uppercase !tracking-wide !px-4 !py-3';
const taskBadge = 'bg-[rgba(99,102,241,0.2)] text-[#a5b4fc] border border-[rgba(99,102,241,0.35)] text-[0.82rem] px-3 py-1 rounded-xl font-semibold';

export default function AdminProjectsPage() {
  const { data, loading, refetch } = useApiData<ClientAccount[]>('/api/admin/projects-overview');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');

  const accounts = useMemo(() => data || [], [data]);

  const filterOptions = useMemo(
    () =>
      accounts.map((acc) => ({
        client_account: acc.client_account,
        projects: acc.projects.map((p) => p.project_name),
      })),
    [accounts]
  );

  const filteredAccounts = useMemo(() => {
    const s = search.toLowerCase().trim();
    const result: (ClientAccount & { total_account_members: number })[] = [];
    let total = 0;
    for (const acc of accounts) {
      const filteredProjects = acc.projects.filter((p) => {
        const matchesFilter = !filter || p.project_name === filter || acc.client_account === filter;
        const matchesSearch =
          !s ||
          acc.client_account.toLowerCase().includes(s) ||
          p.project_name.toLowerCase().includes(s) ||
          p.project_manager.toLowerCase().includes(s) ||
          p.team_lead.toLowerCase().includes(s) ||
          p.members.some((m) => m.name.toLowerCase().includes(s) || m.employee_id.toLowerCase().includes(s));
        return matchesFilter && matchesSearch;
      });
      if (filteredProjects.length > 0) {
        total += filteredProjects.length;
        result.push({
          ...acc,
          projects: filteredProjects,
          total_account_members: filteredProjects.reduce((sum, p) => sum + p.members.length, 0),
        });
      }
    }
    return { list: result, total };
  }, [accounts, search, filter]);

  return (
    <>
      <div className={pageHeaderRow}>
        <div>
          <h1 className={pageHeaderTitle}>Arohak Projects &amp; Teams</h1>
          <p className={pageHeaderSubtitle}>View all active client projects, assigned project managers, team leads, and team members.</p>
        </div>
        <div className={pageHeaderBadges}>
          <div className={lastUpdatedBadge}>
            <span>Total Projects: </span>
            <strong>{loading ? '—' : filteredAccounts.total}</strong>
          </div>
        </div>
      </div>

      <div className={cx(searchPanel, '!mb-6')}>
        <div className="grid grid-cols-[1fr_220px_140px] gap-5 items-end max-[900px]:grid-cols-1">
          <div className={cx(formGroup, '!mb-0')}>
            <label htmlFor="admin-projects-search">Search Project or Employee</label>
            <div className="relative">
              <span className="material-icons-round absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-xl">search</span>
              <input
                type="text"
                id="admin-projects-search"
                placeholder="Search project name, manager, lead, or employee..."
                className="pl-11"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className={cx(formGroup, '!mb-0')}>
            <label htmlFor="admin-projects-filter">Filter Project</label>
            <select id="admin-projects-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All Projects</option>
              {filterOptions.map((acc) => (
                <optgroup key={acc.client_account} label={acc.client_account}>
                  {acc.projects.map((p) => (
                    <option key={p} value={p}>
                      {acc.client_account} — {p}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className={cx(formGroup, '!mb-0', searchBtnGroup, 'self-end')}>
            <button className={cx(btnSecondary, 'w-full')} onClick={() => refetch()}>
              <span className="material-icons-round">refresh</span> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {loading && (
          <div className="text-center flex flex-col items-center gap-3 py-[60px]">
            <Spinner />
            Loading Arohak Projects &amp; Teams...
          </div>
        )}

        {!loading && filteredAccounts.list.length === 0 && (
          <div className={cx(panel, 'text-center p-10 text-text-muted')}>No projects found matching the search/filter criteria.</div>
        )}

        {!loading &&
          filteredAccounts.list.map((acc) => (
            <div key={acc.client_account} className={clientAccountPanel}>
              <div className={clientAccountHeader}>
                <div className="flex items-center gap-3.5">
                  <div className={clientAccountIconBox}>
                    <span className="material-icons-round text-[#818cf8] text-[26px]">domain</span>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-[#818cf8] font-bold">Client Account</div>
                    <h2 className="text-[1.45rem] mt-0.5 text-white font-extrabold tracking-tight">{acc.client_account}</h2>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={accountBadgeIndigo}>
                    <span className="material-icons-round text-base">folder_special</span> {acc.projects.length} Projects under {acc.client_account}
                  </span>
                  <span className={accountBadgeGreen}>
                    <span className="material-icons-round text-base">groups</span> {acc.total_account_members} Total Employees
                  </span>
                </div>
              </div>

              <div className="p-6 flex flex-col gap-6 bg-[rgba(15,23,42,0.4)]">
                {acc.projects.map((p) => (
                  <div key={p.project_name} className={projectCard}>
                    <div className={projectHeader}>
                      <div>
                        <div className="text-[0.72rem] uppercase tracking-wide text-[#94a3b8] font-bold">Project Name</div>
                        <div className="flex items-center gap-2.5 mt-0.5">
                          <span className="material-icons-round text-[#60a5fa] text-[22px]">topic</span>
                          <h3 className="text-[1.2rem] m-0 text-white font-bold">{p.project_name}</h3>
                          <span className={employeesAssignedBadge}>{p.total_members} Employees Assigned</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className={pmBadge}>
                          <span className="material-icons-round text-base text-[#c084fc]">person_pin</span> Project Manager:{' '}
                          <strong className="text-white ml-1">{p.project_manager}</strong>
                        </div>
                        <div className={leadBadge}>
                          <span className="material-icons-round text-base text-[#fbbf24]">stars</span> Team Lead:{' '}
                          <strong className="text-white ml-1">{p.team_lead}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className={cx(adminTable, '!w-full')}>
                        <thead>
                          <tr className="!bg-[#0f172a] !border-b-2 !border-[rgba(148,163,184,0.2)]">
                            <th className={projectTh}>Emp ID</th>
                            <th className={projectTh}>Employee Name</th>
                            <th className={projectTh}>Task Details</th>
                            <th className={projectTh}>Overall Rating</th>
                            <th className={projectTh}>Assignment Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.total_members === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center py-6 text-[#94a3b8] italic">
                                No employees assigned to this project.
                              </td>
                            </tr>
                          ) : (
                            p.members.map((m, idx) => (
                              <tr
                                key={m.employee_id}
                                className={cx('!border-b !border-[rgba(148,163,184,0.1)]', idx % 2 === 0 ? '!bg-[rgba(30,41,59,0.3)]' : '!bg-transparent')}
                              >
                                <td>
                                  <strong className="text-[#60a5fa] font-mono text-[0.9rem]">{m.employee_id.toUpperCase()}</strong>
                                </td>
                                <td>
                                  <strong className="text-white text-[0.92rem]">{m.name}</strong>
                                </td>
                                <td>
                                  <span className={taskBadge}>{m.task_details || 'Developer'}</span>
                                </td>
                                <td>
                                  <strong className="text-[#fbbf24] text-[0.9rem]">{m.overall_rating > 0 ? `${m.overall_rating.toFixed(1)} ★` : '—'}</strong>
                                </td>
                                <td className="!text-[#cbd5e1] !text-[0.88rem]">{m.project_assignment_date}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </>
  );
}
