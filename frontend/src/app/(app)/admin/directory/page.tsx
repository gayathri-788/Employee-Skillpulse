'use client';

import { useState } from 'react';
import { EmployeeDetailsModal } from '@/components/employee-details-modal';
import { Spinner } from '@/components/spinner';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { downloadFile } from '@/lib/download';
import { checkSixMonthsUpdate, formatDate } from '@/lib/format';
import {
  adminSearchGrid,
  adminTable,
  badgeDanger,
  badgeSuccess,
  badgeWarning,
  btnIconOnly,
  btnPrimary,
  btnSecondary,
  cx,
  formGroup,
  pageHeaderRow,
  pageHeaderSubtitle,
  pageHeaderTitle,
  panel,
  searchBtnGroup,
  searchPanel,
  skillTag,
  tableRating,
  topSkillsCell,
} from '@/lib/ui';
import type { Employee } from '@/lib/types';

export default function AdminDirectoryPage() {
  const { authedFetch, token } = useAuth();
  const { showToast } = useToast();
  const [skill, setSkill] = useState('');
  const [project, setProject] = useState('');
  const [exp, setExp] = useState('');
  const [rating, setRating] = useState('');
  const [results, setResults] = useState<Employee[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function runSearch() {
    if (!skill.trim() && !project.trim() && !exp.trim() && !rating.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (skill) params.set('skill', skill);
      if (project) params.set('project', project);
      if (exp) params.set('experience', exp);
      if (rating) params.set('min_rating', rating);
      const data = await authedFetch<Employee[]>(`/api/employees?${params.toString()}`);
      setResults(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error loading records.', 'error');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setSkill('');
    setProject('');
    setExp('');
    setRating('');
    setResults(null);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const filename = `Arohak_Employees_${new Date().toISOString().slice(0, 10)}.xlsx`;
      await downloadFile('/api/admin/employees/export-excel', filename, token);
      showToast('Report downloaded!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div className={pageHeaderRow}>
        <div>
          <h1 className={pageHeaderTitle}>Admin Directory</h1>
          <p className={pageHeaderSubtitle}>Manage and search all employee details.</p>
        </div>
        <button className={btnSecondary} disabled={exporting} onClick={handleExport}>
          <span className="material-icons-round">file_download</span>
          <span>{exporting ? 'Exporting…' : 'Export Excel'}</span>
        </button>
      </div>

      <div className={searchPanel}>
        <div className={adminSearchGrid}>
          <div className={cx(formGroup, '!mb-0')}>
            <label htmlFor="admin-search-skill">Filter by Skill</label>
            <div className="relative">
              <span className="material-icons-round absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-xl">psychology</span>
              <input
                type="text"
                id="admin-search-skill"
                placeholder="e.g. Java, Python"
                className="pl-11"
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
              />
            </div>
          </div>
          <div className={cx(formGroup, '!mb-0')}>
            <label htmlFor="admin-search-project">Filter by Project</label>
            <input
              type="text"
              id="admin-search-project"
              placeholder="e.g. Secure Transfers"
              value={project}
              onChange={(e) => setProject(e.target.value)}
            />
          </div>
          <div className={cx(formGroup, '!mb-0')}>
            <label htmlFor="admin-search-exp">Filter by Experience</label>
            <input type="text" id="admin-search-exp" placeholder="e.g. 5 Years" value={exp} onChange={(e) => setExp(e.target.value)} />
          </div>
          <div className={cx(formGroup, '!mb-0')}>
            <label htmlFor="admin-search-rating">Min Overall Rating</label>
            <select id="admin-search-rating" value={rating} onChange={(e) => setRating(e.target.value)}>
              <option value="">Any Rating</option>
              <option value="4.5">4.5+ Stars</option>
              <option value="4.0">4.0+ Stars</option>
              <option value="3.5">3.5+ Stars</option>
              <option value="3.0">3.0+ Stars</option>
            </select>
          </div>
          <div className={cx(formGroup, '!mb-0', searchBtnGroup)}>
            <button className={btnSecondary} onClick={handleClear}>
              Clear
            </button>
            <button className={btnPrimary} onClick={runSearch}>
              Apply Filters
            </button>
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
                <th>Top Skills</th>
                <th>Overall Rating</th>
                <th>Arohak Exp</th>
                <th>Project Name</th>
                <th>Score</th>
                <th>Last Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="text-center py-10">
                    <div className="flex flex-col items-center gap-3">
                      <Spinner />
                      Loading…
                    </div>
                  </td>
                </tr>
              )}
              {!loading && results === null && (
                <tr>
                  <td colSpan={9} className="text-center py-[60px] px-5 text-text-muted">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <span className="material-icons-round text-4xl text-text-muted">search</span>
                      <h4 className="m-0 text-text-secondary">Filter Admin Directory</h4>
                      <p className="text-[0.85rem] m-0 max-w-[400px] leading-normal">
                        Use the search inputs above (Skills, Project, Experience, or Rating) and click &quot;Apply Filters&quot; to search.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && results !== null && results.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-text-muted py-[30px]">
                    No records match.
                  </td>
                </tr>
              )}
              {!loading &&
                results?.map((emp) => {
                  const skills = [emp.primary_skill, emp.secondary_skill, emp.third_skill].filter(Boolean);
                  const isOutdated = checkSixMonthsUpdate(emp.last_updated);
                  return (
                    <tr key={emp.employee_id}>
                      <td>
                        <strong>{emp.employee_id}</strong>
                      </td>
                      <td>{emp.name}</td>
                      <td>
                        <div className={topSkillsCell}>
                          {skills.map((s) => (
                            <span className={skillTag} key={s}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className={tableRating}>
                          <span className="material-icons-round">star</span>
                          <span>{emp.overall_rating ? emp.overall_rating.toFixed(2) : '0.0'}</span>
                        </div>
                      </td>
                      <td>{emp.arohak_exp || '-'}</td>
                      <td>{emp.project_name || <span className="text-text-muted">Bench</span>}</td>
                      <td>
                        <div className="flex flex-col gap-1 items-start">
                          <span className={emp.score >= 80 ? badgeSuccess : badgeWarning}>{emp.score}%</span>
                          {isOutdated && <span className={cx(badgeDanger, '!text-[0.65rem] !px-1.5 !py-0.5')}>Outdated</span>}
                        </div>
                      </td>
                      <td>{formatDate(emp.last_updated)}</td>
                      <td>
                        <button className={cx(btnSecondary, btnIconOnly)} title="View Profile" onClick={() => setSelectedId(emp.employee_id)}>
                          <span className="material-icons-round">visibility</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      <EmployeeDetailsModal employeeId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
