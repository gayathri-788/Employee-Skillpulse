'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ScoreRing } from '@/components/score-ring';
import { Modal } from '@/components/modal';
import { ResumePreviewModal } from '@/components/resume-preview-modal';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { useAvatar } from '@/lib/use-avatar';
import { downloadFile } from '@/lib/download';
import { API_BASE_URL } from '@/lib/api';
import {
  badgeDanger,
  badgeSuccess,
  btnDanger,
  btnIconOnly,
  btnPrimary,
  btnSecondary,
  colSpan2,
  cx,
  formGroup,
  gridTwo,
  inputDisabled,
  lastUpdatedBadge,
  panel,
  panelBody,
  panelHeader,
  panelHelperText,
  pageHeaderBadges,
  pageHeaderRow,
  pageHeaderSubtitle,
  pageHeaderTitle,
  totalExpBadge,
} from '@/lib/ui';
import type { Employee, EmployeeUpdatePayload } from '@/lib/types';

const alertBanner =
  'flex items-center justify-between gap-4 px-6 py-4 bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.25)] rounded-md mb-[30px] shadow-[0_4px_12px_rgba(245,158,11,0.05)]';
const alertContent = 'flex items-center gap-4';

const skillsGrid = 'flex flex-col gap-[18px]';
const skillRow = 'grid grid-cols-[2fr_3fr] gap-6 items-end pb-[18px] border-b border-dashed border-border last:border-b-0 last:pb-0';
const highlightRow = 'grid grid-cols-[2fr_3fr] gap-6 items-end bg-white/[0.01] p-4 rounded-md border border-border mt-2.5';
const ratingFormGroup = '!mb-0';
const ratingInputContainer = 'flex items-center gap-4';
const ratingRange = 'flex-1 accent-accent-primary h-1.5 rounded-full outline-none';
const ratingBadgeBase = 'px-2.5 py-1 rounded-sm text-sm font-semibold min-w-[44px] text-center border';
const ratingBadge = `${ratingBadgeBase} bg-bg-tertiary border-border text-border-focus`;
const ratingBadgePrimary = `${ratingBadgeBase} bg-accent-glow border-[rgba(16,185,129,0.2)] text-accent-primary`;

const overallRatingCard =
  'mt-[30px] flex items-center justify-between px-6 py-5 bg-gradient-to-r from-bg-tertiary to-accent-glow border border-border rounded-md';

type FormState = {
  name: string;
  email: string;
  contact_number: string;
  joining_date: string;
  project_name: string;
  project_assignment_date: string;
  project_end_date: string;
  primary_skill: string;
  primary_rating: number;
  secondary_skill: string;
  secondary_rating: number;
  third_skill: string;
  third_rating: number;
  work_exp_skills_rating: number;
  previous_exp: string;
  arohak_exp: string;
  certifications: string;
  cert_start_date: string;
  cert_end_date: string;
  expiry_date: string;
  has_laptop: string;
  laptop_details: string;
  has_headset: string;
  headset_details: string;
};

function emptyForm(): FormState {
  return {
    name: '',
    email: '',
    contact_number: '',
    joining_date: '',
    project_name: '',
    project_assignment_date: '',
    project_end_date: '',
    primary_skill: '',
    primary_rating: 0,
    secondary_skill: '',
    secondary_rating: 0,
    third_skill: '',
    third_rating: 0,
    work_exp_skills_rating: 0,
    previous_exp: '',
    arohak_exp: '',
    certifications: '',
    cert_start_date: '',
    cert_end_date: '',
    expiry_date: '',
    has_laptop: 'No',
    laptop_details: '',
    has_headset: 'No',
    headset_details: '',
  };
}

function formFromProfile(p: Employee): FormState {
  return {
    name: p.name || '',
    email: p.email || '',
    contact_number: p.contact_number || '',
    joining_date: p.joining_date ? p.joining_date.split('(')[0].trim() : '',
    project_name: p.project_name || '',
    project_assignment_date: p.project_assignment_date || '',
    project_end_date: p.project_end_date || '',
    primary_skill: p.primary_skill || '',
    primary_rating: p.primary_rating || 0,
    secondary_skill: p.secondary_skill || '',
    secondary_rating: p.secondary_rating || 0,
    third_skill: p.third_skill || '',
    third_rating: p.third_rating || 0,
    work_exp_skills_rating: p.work_exp_skills_rating || 0,
    previous_exp: p.previous_exp || '',
    arohak_exp: p.arohak_exp || '',
    certifications: p.certifications || '',
    cert_start_date: p.cert_start_date || '',
    cert_end_date: p.cert_end_date || '',
    expiry_date: p.expiry_date || '',
    has_laptop: p.has_laptop || 'No',
    laptop_details: p.laptop_details || '',
    has_headset: p.has_headset || 'No',
    headset_details: p.headset_details || '',
  };
}

function parseExpToYears(expStr: string): number {
  const str = (expStr || '').trim();
  if (!str) return 0;
  const plainNum = parseFloat(str);
  if (!isNaN(plainNum) && /^\d+(?:\.\d+)?$/.test(str)) return plainNum;
  let totalYears = 0;
  const yearMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?|y)/i);
  const monthMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:months?|mos?|m)/i);
  if (yearMatch) totalYears += parseFloat(yearMatch[1]);
  if (monthMatch) totalYears += parseFloat(monthMatch[1]) / 12;
  if (!yearMatch && !monthMatch && !isNaN(plainNum)) totalYears = plainNum;
  return Math.round(totalYears * 10) / 10;
}

function formatDecimalYears(years: number): string {
  if (!years || years <= 0) return '0.0 Years';
  return `${(Math.round(years * 10) / 10).toFixed(1)} Years`;
}

function checkSixMonthsUpdate(lastUpdated?: string): boolean {
  if (!lastUpdated) return false;
  const last = new Date(lastUpdated);
  return Math.ceil(Math.abs(Date.now() - last.getTime()) / (1000 * 60 * 60 * 24)) >= 180;
}

export default function ProfilePage() {
  const { authedFetch, token, username } = useAuth();
  const { showToast } = useToast();
  const { avatarUrl, setAvatar, removeAvatar } = useAvatar(username);

  const [profile, setProfile] = useState<Employee | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [resumeModalOpen, setResumeModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeUploadRef = useRef<HTMLInputElement>(null);

  const loadProfile = useCallback(async () => {
    try {
      const data = await authedFetch<Employee>('/api/employees/me');
      setProfile(data);
      setForm(formFromProfile(data));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load profile', 'error');
    } finally {
      setLoading(false);
    }
  }, [authedFetch, showToast]);

  // Fetch-on-mount: syncing React state with the server, the standard justified use of an effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const overallRating = useMemo(() => {
    const active = [form.primary_rating, form.secondary_rating, form.third_rating, form.work_exp_skills_rating].filter((r) => r > 0);
    if (active.length === 0) return 0;
    return active.reduce((a, b) => a + b, 0) / active.length;
  }, [form.primary_rating, form.secondary_rating, form.third_rating, form.work_exp_skills_rating]);

  const totalExpText = useMemo(() => {
    const total = parseExpToYears(form.previous_exp) + parseExpToYears(form.arohak_exp);
    return total > 0 ? formatDecimalYears(Math.round(total * 10) / 10) : '0.0 Years';
  }, [form.previous_exp, form.arohak_exp]);

  const joiningDaysBadge = useMemo(() => {
    if (!form.joining_date) return '';
    const jDate = new Date(`${form.joining_date}T00:00:00`);
    if (isNaN(jDate.getTime())) return '';
    // eslint-disable-next-line react-hooks/purity -- display-only "days since" badge, client-rendered post-auth so no SSR/hydration impact
    const now = Date.now();
    const days = Math.max(0, Math.floor((now - jDate.getTime()) / (1000 * 60 * 60 * 24)));
    return `📅 Tenure: ${days} days since joining date`;
  }, [form.joining_date]);

  const needsUpdate = profile ? checkSixMonthsUpdate(profile.last_updated) : false;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload: EmployeeUpdatePayload = {
      name: form.name,
      email: form.email || null,
      contact_number: form.contact_number || null,
      joining_date: form.joining_date || null,
      primary_skill: form.primary_skill || null,
      primary_rating: form.primary_rating,
      secondary_skill: form.secondary_skill || null,
      secondary_rating: form.secondary_rating,
      third_skill: form.third_skill || null,
      third_rating: form.third_rating,
      previous_exp: form.previous_exp || null,
      arohak_exp: form.arohak_exp || null,
      certifications: form.certifications || null,
      cert_start_date: form.cert_start_date || null,
      cert_end_date: form.cert_end_date || null,
      expiry_date: form.expiry_date || null,
      project_name: form.project_name || null,
      project_assignment_date: form.project_assignment_date || null,
      project_end_date: form.project_end_date || null,
      work_exp_skills_rating: form.work_exp_skills_rating,
      has_laptop: form.has_laptop,
      laptop_details: form.laptop_details || null,
      has_headset: form.has_headset,
      headset_details: form.headset_details || null,
    };
    try {
      const updated = await authedFetch<Employee>('/api/employees/me', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setProfile(updated);
      setForm(formFromProfile(updated));
      showToast('Profile updated successfully!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleAvatarFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG, WebP).', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('File size must be under 5MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      setAvatar(evt.target?.result as string);
      showToast('Profile photo updated successfully!', 'success');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleResumeUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      showToast('Uploading resume...', 'info');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(`${API_BASE_URL}/api/employees/${profile.employee_id}/resume/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(err.detail || 'Upload failed');
      }
      showToast('Resume uploaded successfully!', 'success');
      await loadProfile();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      e.target.value = '';
    }
  }

  async function handleResumeDownload() {
    if (!profile) return;
    const ext = profile.resume_path ? profile.resume_path.split('.').pop() : 'pdf';
    try {
      await downloadFile(`/api/employees/${profile.employee_id}/resume/download-uploaded`, `${profile.employee_id}_resume.${ext}`, token);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Download failed', 'error');
    }
  }

  async function handleResumeDelete() {
    if (!profile) return;
    if (!confirm('Are you sure you want to delete your uploaded custom resume?')) return;
    try {
      await authedFetch(`/api/employees/${profile.employee_id}/resume`, { method: 'DELETE' });
      showToast('Resume deleted successfully.', 'success');
      await loadProfile();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Deletion failed', 'error');
    }
  }

  if (loading) {
    return (
      <div className={pageHeaderRow}>
        <div>
          <h1 className={pageHeaderTitle}>My Profile Details</h1>
          <p className={pageHeaderSubtitle}>Loading…</p>
        </div>
      </div>
    );
  }

  const resumeFilename = profile?.resume_path ? profile.resume_path.split(/[/\\]/).pop() : null;

  return (
    <>
      {needsUpdate && (
        <div className={alertBanner}>
          <div className={alertContent}>
            <span className="material-icons-round text-3xl text-warning">warning_amber</span>
            <div>
              <h3 className="text-base text-alert-title mb-0.5">Profile Update Required!</h3>
              <p className="text-sm text-text-secondary">
                It has been more than 6 months since your last profile update. Please review and update your skills/details below.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={pageHeaderRow}>
        <div>
          <h1 className={pageHeaderTitle}>My Profile Details</h1>
          <p className={pageHeaderSubtitle}>View and keep your skills, certifications, and experience up to date.</p>
        </div>
        <div className={pageHeaderBadges}>
          <ScoreRing score={profile?.score ?? 100} />
          <span className={needsUpdate ? badgeDanger : badgeSuccess}>{needsUpdate ? 'Outdated' : 'Up to Date'}</span>
          <div className={lastUpdatedBadge}>
            <span>Last Updated: </span>
            <strong>{profile ? new Date(profile.last_updated).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}</strong>
          </div>
        </div>
      </div>

      <form id="profile-form" onSubmit={handleSubmit}>
        <div className={panel}>
          <div className={panelHeader}>
            <span className="material-icons-round">badge</span>
            <h2>Basic &amp; Project Information</h2>
          </div>
          <div className={panelBody}>
            <div className={gridTwo}>
              <div className="col-span-2 max-md:col-span-1 flex justify-center mb-4">
                <div
                  className="relative w-32 h-32 cursor-pointer"
                  title="Click for profile photo options"
                  onClick={() => setPhotoModalOpen(true)}
                >
                  <div className="w-full h-full rounded-full bg-bg-tertiary border-4 border-accent-primary flex justify-center items-center overflow-hidden shadow-md">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- data: URL avatar, next/image can't optimize it
                      <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-icons-round text-[5rem] text-accent-secondary">account_circle</span>
                    )}
                  </div>
                  <div className="absolute bottom-1 right-1 w-9 h-9 bg-accent-primary rounded-full flex justify-center items-center text-[#0a0a0a] border-[3px] border-bg-card shadow-sm">
                    <span className="material-icons-round text-xl">photo_camera</span>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFileChange} />
                </div>
              </div>

              <div className={formGroup}>
                <label htmlFor="prof-emp-id">Employee ID</label>
                <input type="text" id="prof-emp-id" readOnly disabled className={inputDisabled} value={profile?.employee_id || ''} />
              </div>
              <div className={formGroup}>
                <label htmlFor="prof-name">Full Name</label>
                <input type="text" id="prof-name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div className={formGroup}>
                <label htmlFor="prof-email">Email Address</label>
                <input type="email" id="prof-email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
              </div>
              <div className={formGroup}>
                <label htmlFor="prof-contact">Contact Number</label>
                <input
                  type="tel"
                  id="prof-contact"
                  placeholder="e.g. +91 9876543210"
                  autoComplete="tel"
                  value={form.contact_number}
                  onChange={(e) => set('contact_number', e.target.value)}
                />
              </div>
              <div className={formGroup}>
                <label htmlFor="prof-joining-date">Joining Date</label>
                <input type="date" id="prof-joining-date" value={form.joining_date} onChange={(e) => set('joining_date', e.target.value)} />
                <span className="text-[0.8rem] text-accent-secondary font-semibold mt-1 block">{joiningDaysBadge}</span>
              </div>
              <div className={formGroup}>
                <label htmlFor="prof-project-name">Assigned Project Name</label>
                <input
                  type="text"
                  id="prof-project-name"
                  placeholder="e.g. ASPAC EDI"
                  value={form.project_name}
                  onChange={(e) => set('project_name', e.target.value)}
                />
              </div>
              <div className={formGroup}>
                <label htmlFor="prof-project-date">Date of Project Assignment</label>
                <input
                  type="date"
                  id="prof-project-date"
                  value={form.project_assignment_date}
                  onChange={(e) => set('project_assignment_date', e.target.value)}
                />
              </div>
              <div className={formGroup}>
                <label htmlFor="prof-project-end-date">Project End Date</label>
                <input
                  type="date"
                  id="prof-project-end-date"
                  value={form.project_end_date}
                  onChange={(e) => set('project_end_date', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={panel}>
          <div className={panelHeader}>
            <span className="material-icons-round">star_rate</span>
            <h2>Technical Skillsets &amp; Ratings</h2>
          </div>
          <div className={panelBody}>
            <p className={panelHelperText}>List your top 3 skills and rate your expertise level from 1 to 5.</p>
            <div className={skillsGrid}>
              {(
                [
                  ['primary_skill', 'primary_rating', 'Primary Skill (Top 1)', 'Primary Rating', 'e.g. React, Java', true],
                  ['secondary_skill', 'secondary_rating', 'Secondary Skill (Top 2)', 'Secondary Rating', 'e.g. Node.js, Sqlite', false],
                  ['third_skill', 'third_rating', 'Third Skillset (Top 3)', 'Third Rating', 'e.g. AWS, Kubernetes', false],
                ] as const
              ).map(([skillKey, ratingKey, skillLabel, ratingLabel, placeholder, required]) => (
                <div className={skillRow} key={skillKey}>
                  <div className={formGroup}>
                    <label htmlFor={`prof-${skillKey}`}>{skillLabel}</label>
                    <input
                      type="text"
                      id={`prof-${skillKey}`}
                      placeholder={placeholder}
                      required={required}
                      value={form[skillKey]}
                      onChange={(e) => set(skillKey, e.target.value)}
                    />
                  </div>
                  <div className={cx(formGroup, ratingFormGroup)}>
                    <label>{ratingLabel}</label>
                    <div className={ratingInputContainer}>
                      <input
                        type="range"
                        className={ratingRange}
                        min={0}
                        max={5}
                        step={0.5}
                        value={form[ratingKey]}
                        onChange={(e) => set(ratingKey, parseFloat(e.target.value))}
                      />
                      <span className={ratingBadge}>{form[ratingKey].toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div className={highlightRow}>
                <div>
                  <h3 className="text-base mb-1">Work Experience Skill Rating</h3>
                  <p className="text-[0.8rem] text-text-muted">
                    Rate the alignment of your work experience with your practical execution skillset.
                  </p>
                </div>
                <div className={cx(formGroup, ratingFormGroup)}>
                  <label>Work Exp Skills Rating</label>
                  <div className={ratingInputContainer}>
                    <input
                      type="range"
                      className={ratingRange}
                      min={0}
                      max={5}
                      step={0.5}
                      value={form.work_exp_skills_rating}
                      onChange={(e) => set('work_exp_skills_rating', parseFloat(e.target.value))}
                    />
                    <span className={ratingBadgePrimary}>{form.work_exp_skills_rating.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className={overallRatingCard}>
              <div>
                <h3 className="text-[1.1rem] mb-0.5">Overall Profile Rating</h3>
                <p className="text-[0.85rem] text-text-secondary">Average of all your skill and experience ratings.</p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-[Outfit,sans-serif] text-[2.5rem] font-extrabold text-accent-primary">{overallRating.toFixed(2)}</span>
                <span className="text-base text-text-muted">/ 5.0</span>
              </div>
            </div>
          </div>
        </div>

        <div className={panel}>
          <div className={panelHeader}>
            <span className="material-icons-round">history_edu</span>
            <h2>Experience Summary</h2>
          </div>
          <div className={cx(panelBody, gridTwo)}>
            <div className={formGroup}>
              <label htmlFor="prof-prev-exp">Previous Experience (Years)</label>
              <input
                type="text"
                id="prof-prev-exp"
                placeholder="e.g. 2.3"
                value={form.previous_exp}
                onChange={(e) => set('previous_exp', e.target.value)}
              />
            </div>
            <div className={formGroup}>
              <label htmlFor="prof-arohak-exp">Arohak Experience (Years)</label>
              <input
                type="text"
                id="prof-arohak-exp"
                placeholder="e.g. 1.5"
                value={form.arohak_exp}
                onChange={(e) => set('arohak_exp', e.target.value)}
              />
            </div>
            <div className={cx(formGroup, colSpan2)}>
              <label>Total Overall Experience</label>
              <div className={totalExpBadge}>
                <span className="material-icons-round">work_history</span>
                <span>{totalExpText}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={panel}>
          <div className={panelHeader}>
            <span className="material-icons-round">workspace_premium</span>
            <h2>Certifications</h2>
          </div>
          <div className={cx(panelBody, gridTwo)}>
            <div className={cx(formGroup, colSpan2)}>
              <label htmlFor="prof-certifications">Certifications</label>
              <input
                type="text"
                id="prof-certifications"
                placeholder="e.g. ITIL V4, AWS Solutions Architect, Azure Fundamentals"
                value={form.certifications}
                onChange={(e) => set('certifications', e.target.value)}
              />
            </div>
            <div className={formGroup}>
              <label htmlFor="prof-cert-start">Certificate Start Date (or Year of Completion)</label>
              <input
                type="text"
                id="prof-cert-start"
                placeholder="e.g. 2024 or 2024-05-12"
                value={form.cert_start_date}
                onChange={(e) => set('cert_start_date', e.target.value)}
              />
            </div>
            <div className={formGroup}>
              <label htmlFor="prof-cert-end">Certificate End Date</label>
              <input type="date" id="prof-cert-end" value={form.cert_end_date} onChange={(e) => set('cert_end_date', e.target.value)} />
            </div>
            <div className={cx(formGroup, colSpan2)}>
              <label htmlFor="prof-cert-expiry">Certificate Expiry Date</label>
              <input type="date" id="prof-cert-expiry" value={form.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} />
            </div>
          </div>
        </div>

        <div className={panel}>
          <div className={panelHeader}>
            <span className="material-icons-round">devices</span>
            <h2>Office Assets &amp; Equipment</h2>
          </div>
          <div className={cx(panelBody, gridTwo)}>
            <div className={formGroup}>
              <label htmlFor="prof-has-laptop">Has Laptop Issued?</label>
              <select id="prof-has-laptop" value={form.has_laptop} onChange={(e) => set('has_laptop', e.target.value)}>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
            <div className={formGroup}>
              <label htmlFor="prof-laptop-details">Laptop Model Number</label>
              <input
                type="text"
                id="prof-laptop-details"
                placeholder="e.g. Dell Latitude 5420"
                value={form.laptop_details}
                onChange={(e) => set('laptop_details', e.target.value)}
              />
            </div>
            <div className={formGroup}>
              <label htmlFor="prof-has-headset">Has Headset Issued?</label>
              <select id="prof-has-headset" value={form.has_headset} onChange={(e) => set('has_headset', e.target.value)}>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
            <div className={formGroup}>
              <label htmlFor="prof-headset-details">Headset Serial Number S/N</label>
              <input
                type="text"
                id="prof-headset-details"
                placeholder="e.g. S/N: HS-987654"
                value={form.headset_details}
                onChange={(e) => set('headset_details', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className={cx(panel, 'mt-6')}>
          <div className={panelHeader}>
            <span className="material-icons-round">description</span>
            <h2>Resume Management</h2>
          </div>
          <div className={panelBody}>
            <p className={panelHelperText}>
              Download your automatically generated profile resume, or upload your own custom resume file (PDF, DOC, DOCX).
            </p>
            <div className="flex gap-4 items-center flex-wrap mt-3">
              <button type="button" className={cx(btnSecondary, 'flex items-center gap-2')} onClick={() => setResumeModalOpen(true)}>
                <span className="material-icons-round">visibility</span>
                <span>View Generated Resume</span>
              </button>

              <input ref={resumeUploadRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleResumeUpload} />
              <button
                type="button"
                className={cx(btnPrimary, 'flex items-center gap-2')}
                onClick={() => resumeUploadRef.current?.click()}
              >
                <span className="material-icons-round">upload_file</span>
                <span>{resumeFilename ? 'Replace Resume' : 'Upload Resume'}</span>
              </button>

              {resumeFilename && (
                <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-md border border-border">
                  <span className="material-icons-round text-accent-secondary">check_circle</span>
                  <span className="text-sm font-medium">{resumeFilename}</span>
                  <button
                    type="button"
                    className={cx(btnSecondary, btnIconOnly, '!p-1')}
                    title="Download Uploaded Resume"
                    onClick={handleResumeDownload}
                  >
                    <span className="material-icons-round text-lg">download</span>
                  </button>
                  <button type="button" className={cx(btnDanger, btnIconOnly, '!p-1')} title="Delete Resume" onClick={handleResumeDelete}>
                    <span className="material-icons-round text-lg">delete</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end items-center">
          <button type="submit" className={cx(btnPrimary, '!px-7 !py-3 !text-base font-semibold')} disabled={saving}>
            <span className="material-icons-round">save</span>
            <span>{saving ? 'Updating Profile…' : 'Update Profile'}</span>
          </button>
        </div>
      </form>

      <Modal open={photoModalOpen} onClose={() => setPhotoModalOpen(false)} title="Profile Photo Options" size="sm">
        <p className="mb-4 text-text-secondary text-[0.88rem]">
          Select an option below to upload a new picture or delete your current profile image.
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className={cx(btnPrimary, 'w-full justify-center')}
            onClick={() => {
              setPhotoModalOpen(false);
              setTimeout(() => fileInputRef.current?.click(), 150);
            }}
          >
            <span className="material-icons-round">upload_file</span>
            <span>Upload Image</span>
          </button>
          <button
            type="button"
            className={cx(btnSecondary, 'w-full justify-center')}
            onClick={() => {
              setPhotoModalOpen(false);
              if (avatarUrl) {
                removeAvatar();
                showToast('Profile image deleted successfully.', 'info');
              } else {
                showToast('No uploaded profile image to remove.', 'warning');
              }
            }}
          >
            <span className="material-icons-round">delete_outline</span>
            <span>Delete Image</span>
          </button>
          <button type="button" className={cx(btnSecondary, 'w-full')} onClick={() => setPhotoModalOpen(false)}>
            Cancel
          </button>
        </div>
      </Modal>

      <ResumePreviewModal open={resumeModalOpen} onClose={() => setResumeModalOpen(false)} employeeId={profile?.employee_id ?? null} />
    </>
  );
}
