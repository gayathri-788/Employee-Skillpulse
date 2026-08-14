'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/modal';
import { API_BASE_URL, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { btnPrimary, btnSecondary, cx, formGroup } from '@/lib/ui';
import type { Employee, EmployeeRestricted } from '@/lib/types';

interface ResumeFields {
  name: string;
  job_title: string;
  linkedin: string;
  email: string;
  phone: string;
  location: string;
  executive_summary: string;
  core_competencies: string;
  key_clients: string;
  arohak_title: string;
  arohak_start: string;
  arohak_resp: string;
  prev_company: string;
  prev_location: string;
  prev_title: string;
  prev_tenure: string;
  prev_resp: string;
  achievements: string;
  education: string;
  industry_experience: string;
  certifications: string;
  tools_technologies: string;
}

function buildDefaults(emp: Partial<Employee & EmployeeRestricted>): ResumeFields {
  const comps: string[] = [];
  if (emp.primary_skill) comps.push(`* ${emp.primary_skill}: expert in application engineering and support`);
  if (emp.secondary_skill) comps.push(`* ${emp.secondary_skill}: proficient developer and administrator`);
  if (emp.third_skill) comps.push(`* ${emp.third_skill}: knowledgeable technical support specialist`);

  let exec = `A dedicated professional with experience in technical execution, system configuration, and software application processes. Proven capabilities in ${emp.primary_skill || 'key technology areas'}, focused on driving efficiency and high-quality deliverables.`;
  if (emp.project_name) exec += ` Currently assigned to the ${emp.project_name} project at Arohak Technologies.`;

  const tools = [emp.primary_skill, emp.secondary_skill, emp.third_skill].filter(Boolean).join(', ');

  return {
    name: emp.name || '',
    job_title: emp.primary_skill || 'Technical Associate',
    linkedin: '',
    email: emp.email || '',
    phone: '',
    location: 'HYDERABAD, INDIA',
    executive_summary: exec,
    core_competencies: comps.length > 0 ? comps.join('\n') : 'Technical operations and development support',
    key_clients: 'Internal and client-assigned development projects',
    arohak_title: `Technical Associate - ${emp.primary_skill || 'Developer'}`,
    arohak_start: 'Dec 2025 – Present',
    arohak_resp: emp.arohak_exp || 'Active team member participating in project delivery and system execution matching primary skills.',
    prev_company: 'Previous Company Name',
    prev_location: 'Location',
    prev_title: 'Job Title',
    prev_tenure: 'Start Date – End Date',
    prev_resp: emp.previous_exp || '* Summaries your Job role in your company , Roles & Responsibilities',
    achievements: '* List your achievements throughout your career',
    education: 'List your educational achievements with details about your college and pass out year (MM/YYYY)',
    industry_experience:
      'Banking & Financial Services | Manufacturing | Retail & Consumer Goods | Energy & Utilities | Enterprise Technology Services | Infrastructure & Managed Services',
    certifications: emp.certifications || 'List your certifications . Name of the certification , Exam ID and pass out year and month',
    tools_technologies: tools || 'ServiceNow, SAP',
  };
}

const FIELD_LABELS: [keyof ResumeFields, string, boolean][] = [
  ['name', 'Full Name', false],
  ['job_title', 'Job Title', false],
  ['linkedin', 'LinkedIn (without https://)', false],
  ['email', 'Email', false],
  ['phone', 'Phone', false],
  ['location', 'Location', false],
  ['executive_summary', 'Executive Summary', true],
  ['core_competencies', 'Core Competencies', true],
  ['key_clients', 'Key Clients Supported', true],
  ['arohak_title', 'Arohak Title', false],
  ['arohak_start', 'Arohak Start Date', false],
  ['arohak_resp', 'Arohak Responsibilities', true],
  ['prev_company', 'Previous Company', false],
  ['prev_location', 'Previous Location', false],
  ['prev_title', 'Previous Job Title', false],
  ['prev_tenure', 'Previous Tenure', false],
  ['prev_resp', 'Previous Responsibilities', true],
  ['achievements', 'Career Achievements', true],
  ['education', 'Education', true],
  ['industry_experience', 'Industry Experience', true],
  ['certifications', 'Certifications', true],
  ['tools_technologies', 'Tools & Technologies', true],
];

export function ResumePreviewModal({
  open,
  onClose,
  employeeId,
}: {
  open: boolean;
  onClose: () => void;
  employeeId: string | null;
}) {
  const { token, authedFetch } = useAuth();
  const { showToast } = useToast();
  const [fields, setFields] = useState<ResumeFields | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Fetch-on-open: syncing editable fields with the server-side employee record.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open || !employeeId) {
      setFields(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const emp = await authedFetch<Partial<Employee & EmployeeRestricted>>(`/api/employees/${employeeId}`);
        if (!cancelled) setFields(buildDefaults(emp));
      } catch (err) {
        if (!cancelled) {
          showToast(err instanceof Error ? err.message : 'Failed to load profile for preview', 'error');
          onClose();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- authedFetch/onClose/showToast identity changes shouldn't refetch
  }, [open, employeeId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function update<K extends keyof ResumeFields>(key: K, value: string) {
    setFields((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleDownload() {
    if (!fields || !employeeId) return;
    setDownloading(true);
    try {
      showToast('Downloading customized PDF...', 'info');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/api/employees/${employeeId}/resume/download-generated-custom`, {
        method: 'POST',
        headers,
        body: JSON.stringify(fields),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Download failed' }));
        throw new ApiError(err.detail || 'Download failed', response.status);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${employeeId}_custom_generated_resume.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('PDF downloaded successfully!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Download failed', 'error');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Modal
      open={open && !!fields}
      onClose={onClose}
      title="Customize & Download Resume"
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose}>
            Close
          </button>
          <button type="button" className={btnPrimary} onClick={handleDownload} disabled={downloading}>
            <span className="material-icons-round">download</span>
            <span>{downloading ? 'Downloading…' : 'Download PDF'}</span>
          </button>
        </>
      }
    >
      {fields && (
        <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
          {FIELD_LABELS.map(([key, label, isTextarea]) => (
            <div className={cx(formGroup, isTextarea && 'col-span-2')} key={key}>
              <label htmlFor={`res-edit-${key}`}>{label}</label>
              {isTextarea ? (
                <textarea
                  id={`res-edit-${key}`}
                  rows={3}
                  value={fields[key]}
                  onChange={(e) => update(key, e.target.value)}
                />
              ) : (
                <input
                  id={`res-edit-${key}`}
                  type="text"
                  value={fields[key]}
                  onChange={(e) => update(key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
