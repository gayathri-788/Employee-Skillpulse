'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { EmployeeDetailsModal } from '@/components/employee-details-modal';
import { Spinner } from '@/components/spinner';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { checkSixMonthsUpdate } from '@/lib/format';
import {
  badgeWarning,
  btnPrimary,
  btnSecondary,
  cx,
  empCard,
  formGroup,
  pageHeaderRow,
  pageHeaderSubtitle,
  pageHeaderTitle,
  searchBtnGroup,
  searchGrid,
  searchPanel,
  skillTag,
  skillTagPrimary,
} from '@/lib/ui';
import type { Employee, EmployeeRestricted } from '@/lib/types';

type DirectoryEntry = Employee | EmployeeRestricted;

export default function DirectoryPage() {
  const { authedFetch } = useAuth();
  const { showToast } = useToast();
  const [skill, setSkill] = useState('');
  const [project, setProject] = useState('');
  const [exp, setExp] = useState('');
  const [results, setResults] = useState<DirectoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function runSearch(s: string, p: string, e: string) {
    if (!s.trim() && !p.trim() && !e.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (s) params.set('skill', s);
      if (p) params.set('project', p);
      if (e) params.set('experience', e);
      const data = await authedFetch<DirectoryEntry[]>(`/api/employees?${params.toString()}`);
      setResults(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load data.', 'error');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setSkill('');
    setProject('');
    setExp('');
    setResults(null);
  }

  return (
    <>
      <div className={pageHeaderRow}>
        <div>
          <h1 className={pageHeaderTitle}>Employee Directory</h1>
          <p className={pageHeaderSubtitle}>Search and view profiles of other team members at Arohak.</p>
        </div>
      </div>

      <div className={searchPanel}>
        <div className={searchGrid}>
          <div className={cx(formGroup, '!mb-0')}>
            <label htmlFor="search-skill">Search Technical Skill</label>
            <div className="relative">
              <span className="material-icons-round absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-xl">search</span>
              <input
                type="text"
                id="search-skill"
                placeholder="e.g. React, Java, AWS"
                className="pl-11"
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch(skill, project, exp)}
              />
            </div>
          </div>
          <div className={cx(formGroup, '!mb-0')}>
            <label htmlFor="search-project">Project Name</label>
            <input
              type="text"
              id="search-project"
              placeholder="e.g. Kenvue"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch(skill, project, exp)}
            />
          </div>
          <div className={cx(formGroup, '!mb-0')}>
            <label htmlFor="search-exp">Experience Keyword</label>
            <input
              type="text"
              id="search-exp"
              placeholder="e.g. Senior, Years"
              value={exp}
              onChange={(e) => setExp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch(skill, project, exp)}
            />
          </div>
          <div className={cx(formGroup, '!mb-0', searchBtnGroup)}>
            <button className={btnSecondary} onClick={handleClear}>
              Clear
            </button>
            <button className={btnPrimary} onClick={() => runSearch(skill, project, exp)}>
              Search
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 text-text-secondary text-[0.9rem]">
        <span>
          Showing <strong>{results?.length ?? 0}</strong> employees
        </span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6">
        {loading && (
          <div className="col-span-full text-center p-10 flex flex-col items-center gap-3">
            <Spinner />
            Loading directory...
          </div>
        )}

        {!loading && results === null && (
          <div className="col-span-full text-center py-[60px] px-5 border border-dashed border-border rounded-md bg-white/[0.01] flex flex-col items-center justify-center gap-3">
            <span className="material-icons-round text-5xl text-text-muted">search</span>
            <h3 className="m-0 text-text-secondary text-[1.2rem]">Search Employee Directory</h3>
            <p className="text-sm text-text-muted max-w-[400px] m-0 leading-normal">
              Enter a skill, project, or experience level above and click &quot;Search&quot; to search the Arohak directory.
            </p>
          </div>
        )}

        {!loading && results !== null && results.length === 0 && (
          <div className="col-span-full text-center p-10 text-text-muted">No employees found matching the filters.</div>
        )}

        {!loading &&
          results?.map((emp) => {
            const skills = [emp.primary_skill, emp.secondary_skill, emp.third_skill].filter(Boolean) as string[];
            const isOutdated = 'last_updated' in emp && checkSixMonthsUpdate(emp.last_updated);
            return (
              <motion.div
                key={emp.employee_id}
                className={empCard}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.15 }}
                onClick={() => setSelectedId(emp.employee_id)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[1.15rem] font-semibold mb-0.5">{emp.name}</h3>
                      {isOutdated && <span className={cx(badgeWarning, '!text-[0.6rem] !px-1.5 !py-0.5')}>Outdated</span>}
                    </div>
                    <span className="text-[0.8rem] text-text-muted font-mono">{emp.employee_id}</span>
                  </div>
                  <div className="bg-bg-tertiary border border-border px-2.5 py-1 rounded-sm text-xs max-w-[140px] whitespace-nowrap overflow-hidden text-ellipsis text-right">
                    {emp.project_name || 'Bench'}
                  </div>
                </div>
                <div className="mb-3">
                  <h4 className="text-xs font-medium text-text-muted uppercase mb-1.5 tracking-wide">Technical Skillset</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.length > 0 ? (
                      skills.map((s, i) => (
                        <span className={i === 0 ? skillTagPrimary : skillTag} key={s}>
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-text-muted">None listed</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between gap-2.5 text-[0.85rem]">
                  <div className="flex flex-col">
                    <span className="text-[0.7rem] text-text-muted uppercase">Arohak Exp</span>
                    <span className="font-medium text-text-secondary whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]">
                      {emp.arohak_exp || '-'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[0.7rem] text-text-muted uppercase">Past Exp</span>
                    <span className="font-medium text-text-secondary whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]">
                      {emp.previous_exp || '-'}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
      </div>

      <EmployeeDetailsModal employeeId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
