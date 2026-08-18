'use client';

import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/modal';
import { Spinner } from '@/components/spinner';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { useApiData } from '@/lib/use-api-data';
import {
  btnDanger,
  btnIconOnly,
  btnPrimary,
  btnSecondary,
  cx,
  formGroup,
  pageHeaderRow,
  pageHeaderSubtitle,
  pageHeaderTitle,
} from '@/lib/ui';
import type { Talent, TalentCategory, TalentPayload } from '@/lib/types';

const CATEGORIES: TalentCategory[] = ['Sport', 'Cultural', 'Hobby', 'Other'];

const talentsGrid = 'grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4';
const talentCard =
  'bg-bg-card border border-border rounded-lg p-5 backdrop-blur-md transition-[box-shadow,border-color] duration-150 flex flex-col gap-2.5 hover:shadow-md hover:border-border-hover';
const talentCategoryBadge =
  'inline-flex items-center px-2.5 py-1 rounded-full text-[0.72rem] font-semibold bg-bg-tertiary text-text-secondary border border-border w-fit';

type FormState = {
  id: number | null;
  category: TalentCategory;
  name: string;
  note: string;
};

const EMPTY_FORM: FormState = {
  id: null,
  category: 'Sport',
  name: '',
  note: '',
};

export default function TalentsPage() {
  const { authedFetch } = useAuth();
  const { showToast } = useToast();
  const { data: talents, loading, refetch } = useApiData<Talent[]>('/api/talents/me');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function openAdd() {
    setForm(EMPTY_FORM);
  }

  function openEdit(talent: Talent) {
    setForm({
      id: talent.id,
      category: talent.category,
      name: talent.name,
      note: talent.note || '',
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    const payload: TalentPayload = {
      category: form.category,
      name: form.name,
      note: form.note || null,
    };
    try {
      if (form.id) {
        await authedFetch(`/api/talents/me/${form.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Talent updated!', 'success');
      } else {
        await authedFetch('/api/talents/me', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Talent added!', 'success');
      }
      setForm(null);
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error saving talent', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this talent?')) return;
    try {
      await authedFetch(`/api/talents/me/${id}`, { method: 'DELETE' });
      showToast('Talent deleted.', 'success');
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error deleting talent', 'error');
    }
  }

  return (
    <>
      <div className={pageHeaderRow}>
        <div>
          <h1 className={pageHeaderTitle}>Talents & Activities</h1>
          <p className={pageHeaderSubtitle}>
            Sports, cultural activities, hobbies — anything you want teammates to know about you beyond the job.
          </p>
        </div>
        <button className={btnPrimary} onClick={openAdd}>
          <span className="material-icons-round">add</span>
          <span>Add Talent</span>
        </button>
      </div>

      <div className={talentsGrid}>
        {loading && (
          <div className="text-center py-[60px] col-span-full flex flex-col items-center gap-3">
            <Spinner />
            Loading talents…
          </div>
        )}

        {!loading && (!talents || talents.length === 0) && (
          <div className="text-text-muted col-span-full text-center py-12">
            <span className="material-icons-round text-5xl block mb-3 text-border">sports_soccer</span>
            No talents added yet. Click <strong>Add Talent</strong> to begin.
          </div>
        )}

        {!loading &&
          talents?.map((t) => (
            <div className={talentCard} key={t.id}>
              <span className={talentCategoryBadge}>{t.category}</span>
              <div className="text-base font-bold text-text-primary">{t.name}</div>
              {t.note && <div className="text-[0.82rem] text-text-muted leading-relaxed">{t.note}</div>}
              <div className="flex gap-2 justify-end mt-auto pt-2.5 border-t border-border">
                <button className={cx(btnSecondary, btnIconOnly)} title="Edit" onClick={() => openEdit(t)}>
                  <span className="material-icons-round">edit</span>
                </button>
                <button className={cx(btnDanger, btnIconOnly)} title="Delete" onClick={() => handleDelete(t.id)}>
                  <span className="material-icons-round">delete_outline</span>
                </button>
              </div>
            </div>
          ))}
      </div>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit Talent' : 'Add Talent'}
        footer={
          <>
            <button type="button" className={btnSecondary} onClick={() => setForm(null)}>
              Cancel
            </button>
            <button type="submit" form="talent-form" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : form?.id ? 'Update Talent' : 'Save Talent'}
            </button>
          </>
        }
      >
        {form && (
          <form id="talent-form" onSubmit={handleSubmit}>
            <div className={formGroup}>
              <label htmlFor="talent-category">Category</label>
              <select id="talent-category" value={form.category} onChange={(e) => set('category', e.target.value as TalentCategory)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className={formGroup}>
              <label htmlFor="talent-name">Name</label>
              <input
                id="talent-name"
                type="text"
                required
                placeholder="e.g. Badminton, Classical Singing, Photography"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </div>
            <div className={formGroup}>
              <label htmlFor="talent-note">Note (optional)</label>
              <textarea id="talent-note" rows={3} value={form.note} onChange={(e) => set('note', e.target.value)} />
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
