'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Modal } from '@/components/modal';
import { Spinner } from '@/components/spinner';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { useApiData } from '@/lib/use-api-data';
import { formatDate } from '@/lib/format';
import { targetBadgeClasses, targetCardBarClasses } from '@/lib/status';
import {
  btnDanger,
  btnIconOnly,
  btnPrimary,
  btnSecondary,
  cx,
  formGroup,
  gridTwo,
  pageHeaderRow,
  pageHeaderSubtitle,
  pageHeaderTitle,
  searchGrid,
  searchPanel,
} from '@/lib/ui';
import type { SkillTarget, SkillTargetPayload, SkillTargetStatus } from '@/lib/types';

const skillTargetsGrid = 'grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4';
const skillTargetCard =
  'bg-bg-card border border-border rounded-lg p-5 backdrop-blur-md transition-[box-shadow,border-color] duration-150 flex flex-col gap-2.5 relative overflow-hidden hover:shadow-md hover:border-border-hover';
const skillTargetCardBar = 'absolute top-0 left-0 right-0 h-[3px] rounded-t-lg bg-gradient-to-r';
const skillTargetStatusBadgeBase =
  'inline-flex items-center px-2.5 py-1 rounded-full text-[0.72rem] font-bold tracking-wide uppercase border';
const skillTargetLevelBadge =
  'inline-flex items-center px-2.5 py-1 rounded-full text-[0.72rem] font-semibold bg-bg-tertiary text-text-secondary border border-border';

type FormState = {
  id: number | null;
  skill_name: string;
  description: string;
  target_level: string;
  status: SkillTargetStatus;
  target_completion_date: string;
};

const EMPTY_FORM: FormState = {
  id: null,
  skill_name: '',
  description: '',
  target_level: '',
  status: 'Planned',
  target_completion_date: '',
};

export default function SkillTargetsPage() {
  const { authedFetch } = useAuth();
  const { showToast } = useToast();
  const { data: targets, loading, refetch } = useApiData<SkillTarget[]>('/api/skilltargets/me');
  const [yearFilter, setYearFilter] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const years = useMemo(() => {
    const set = new Set((targets || []).map((t) => t.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [targets]);

  const filtered = useMemo(() => {
    if (!targets) return [];
    return yearFilter ? targets.filter((t) => String(t.year) === yearFilter) : targets;
  }, [targets, yearFilter]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function openAdd() {
    setForm(EMPTY_FORM);
  }

  function openEdit(target: SkillTarget) {
    setForm({
      id: target.id,
      skill_name: target.skill_name,
      description: target.description || '',
      target_level: target.target_level || '',
      status: target.status,
      target_completion_date: target.target_completion_date || '',
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    const payload: SkillTargetPayload = {
      skill_name: form.skill_name,
      description: form.description || null,
      target_level: form.target_level || null,
      status: form.status,
      target_completion_date: form.target_completion_date || null,
    };
    try {
      if (form.id) {
        await authedFetch(`/api/skilltargets/me/${form.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Skill target updated!', 'success');
      } else {
        await authedFetch('/api/skilltargets/me', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Skill target added!', 'success');
      }
      setForm(null);
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error saving target', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this skill target?')) return;
    try {
      await authedFetch(`/api/skilltargets/me/${id}`, { method: 'DELETE' });
      showToast('Skill target deleted.', 'success');
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error deleting target', 'error');
    }
  }

  return (
    <>
      <div className={pageHeaderRow}>
        <div>
          <h1 className={pageHeaderTitle}>Employee Growth Targets</h1>
          <p className={pageHeaderSubtitle}>Set and track the skills you plan to learn or achieve by year-end.</p>
        </div>
        <button className={btnPrimary} onClick={openAdd}>
          <span className="material-icons-round">add</span>
          <span>Add Skill Target</span>
        </button>
      </div>

      <div className={cx(searchPanel, '!mb-6')}>
        <div className={cx(searchGrid, '!grid-cols-[180px_1fr]')}>
          <div className={cx(formGroup, '!mb-0')}>
            <label htmlFor="targets-year-filter">Filter by Year</label>
            <select id="targets-year-filter" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="">All Years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={skillTargetsGrid}>
        {loading && (
          <div className="text-center py-[60px] col-span-full flex flex-col items-center gap-3">
            <Spinner />
            Loading targets…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-text-muted col-span-full text-center py-12">
            <span className="material-icons-round text-5xl block mb-3 text-border">flag</span>
            No skill targets set{yearFilter ? ` for ${yearFilter}` : ''}. Click <strong>Add Skill Target</strong> to begin.
          </div>
        )}

        {!loading &&
          filtered.map((t) => {
            const statusLabel = t.status === 'In Progress' ? 'On-Going' : t.status;
            return (
              <div className={skillTargetCard} key={t.id}>
                <div className={cx(skillTargetCardBar, targetCardBarClasses(t.status))} />
                <div className="text-base font-bold text-text-primary">{t.skill_name}</div>
                {t.description && <div className="text-[0.82rem] text-text-muted leading-relaxed">{t.description}</div>}
                <div className="flex gap-2 flex-wrap items-center mt-1">
                  <span className={cx(skillTargetStatusBadgeBase, targetBadgeClasses(t.status))}>{statusLabel}</span>
                  {t.target_level && <span className={skillTargetLevelBadge}>{t.target_level}</span>}
                  <span className="text-[0.72rem] text-text-muted">{t.year}</span>
                </div>
                {t.target_completion_date && (
                  <div className="text-[0.76rem] text-text-muted flex items-center gap-1 mt-0.5">
                    <span className="material-icons-round text-sm">event</span>
                    Target: {formatDate(t.target_completion_date)}
                  </div>
                )}
                <div className="flex gap-2 justify-end mt-auto pt-2.5 border-t border-border">
                  <button className={cx(btnSecondary, btnIconOnly)} title="Edit" onClick={() => openEdit(t)}>
                    <span className="material-icons-round">edit</span>
                  </button>
                  <button className={cx(btnDanger, btnIconOnly)} title="Delete" onClick={() => handleDelete(t.id)}>
                    <span className="material-icons-round">delete_outline</span>
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit Skill Target' : 'Add Skill Target'}
        footer={
          <>
            <button type="button" className={btnSecondary} onClick={() => setForm(null)}>
              Cancel
            </button>
            <button type="submit" form="skill-target-form" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : form?.id ? 'Update Target' : 'Save Target'}
            </button>
          </>
        }
      >
        {form && (
          <form id="skill-target-form" onSubmit={handleSubmit}>
            <div className={formGroup}>
              <label htmlFor="st-skill-name">Skill Name</label>
              <input
                id="st-skill-name"
                type="text"
                required
                value={form.skill_name}
                onChange={(e) => set('skill_name', e.target.value)}
              />
            </div>
            <div className={formGroup}>
              <label htmlFor="st-description">Description</label>
              <textarea id="st-description" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>
            <div className={gridTwo}>
              <div className={formGroup}>
                <label htmlFor="st-level">Target Level</label>
                <input
                  id="st-level"
                  type="text"
                  placeholder="e.g. Intermediate"
                  value={form.target_level}
                  onChange={(e) => set('target_level', e.target.value)}
                />
              </div>
              <div className={formGroup}>
                <label htmlFor="st-status">Status</label>
                <select id="st-status" value={form.status} onChange={(e) => set('status', e.target.value as SkillTargetStatus)}>
                  <option value="Planned">Planned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>
            <div className={formGroup}>
              <label htmlFor="st-completion-date">Target Completion Date</label>
              <input
                id="st-completion-date"
                type="date"
                value={form.target_completion_date}
                onChange={(e) => set('target_completion_date', e.target.value)}
              />
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
