'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/modal';
import { ResumePreviewModal } from '@/components/resume-preview-modal';
import { Spinner } from '@/components/spinner';
import { StarRating } from '@/components/star-rating';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { downloadFile } from '@/lib/download';
import { formatDate, monthsToString, parseExpToMonths } from '@/lib/format';
import { btnPrimary, btnSecondary, btnSm, cx } from '@/lib/ui';
import type { Employee, EmployeeRestricted } from '@/lib/types';

function isFullDetails(emp: Employee | EmployeeRestricted): emp is Employee {
  return 'overall_rating' in emp && 'score' in emp;
}

const detailSection = 'bg-bg-tertiary border border-border rounded-md p-5';
const detailSectionHeading = 'text-base uppercase tracking-wide text-accent-primary mb-4 border-b border-border pb-2';
const detailRowGrid = 'grid grid-cols-2 gap-4';
const detailItem = 'flex flex-col';
const detailItemLbl = 'text-xs text-text-muted uppercase';
const detailItemVal = 'text-[0.95rem] text-text-primary font-medium mt-0.5';
const detailItemValHighlight = 'text-border-focus font-semibold';
const detailSkillsList = 'flex flex-col gap-3';
const detailSkillRow = 'flex justify-between items-center';

export function EmployeeDetailsModal({ employeeId, onClose }: { employeeId: string | null; onClose: () => void }) {
  const { authedFetch, token } = useAuth();
  const { showToast } = useToast();
  const [emp, setEmp] = useState<Employee | EmployeeRestricted | null>(null);
  const [loading, setLoading] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);

  // Fetch-on-open: syncing modal content with the server-side employee record.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!employeeId) {
      setEmp(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setEmp(null);
    (async () => {
      try {
        const data = await authedFetch<Employee | EmployeeRestricted>(`/api/employees/${employeeId}`);
        if (!cancelled) setEmp(data);
      } catch (err) {
        if (!cancelled) {
          showToast(err instanceof Error ? err.message : 'Failed to load employee', 'error');
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- authedFetch/onClose/showToast identity changes shouldn't refetch
  }, [employeeId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleDownloadUploaded() {
    if (!emp?.resume_path) return;
    const ext = emp.resume_path.split('.').pop();
    try {
      await downloadFile(`/api/employees/${emp.employee_id}/resume/download-uploaded`, `${emp.employee_id}_resume.${ext}`, token);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Download failed', 'error');
    }
  }

  const full = emp && isFullDetails(emp) ? emp : null;

  return (
    <>
      <Modal open={!!employeeId} onClose={onClose} title={emp ? `${emp.name} Details` : 'Loading profile details...'}>
        {loading && (
          <div className="flex flex-col items-center gap-3 py-10 text-text-muted">
            <Spinner />
            Loading profile...
          </div>
        )}
        {emp && (
          <div className="flex flex-col gap-6">
            {full && (
              <div className="flex items-center gap-4 p-4 bg-accent-glow border border-[rgba(16,185,129,0.2)] rounded-md mb-4">
                <div className="w-[60px] h-[60px] rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-[1.4rem] font-bold text-white shadow-[0_0_15px_rgba(16,185,129,0.25)]">
                  {full.overall_rating ? full.overall_rating.toFixed(1) : '0.0'}
                </div>
                <div>
                  <h4 className="text-[0.95rem] mb-0.5">Overall Profile Rating</h4>
                  <p className="text-[0.8rem] text-text-secondary">
                    Portal Score: <strong>{full.score}%</strong> (Last Updated: {formatDate(full.last_updated)})
                  </p>
                </div>
              </div>
            )}

            <div className={detailSection}>
              <h3 className={detailSectionHeading}>{full ? 'Employee Information' : 'Employee Details'}</h3>
              <div className={detailRowGrid}>
                <div className={detailItem}>
                  <span className={detailItemLbl}>Employee ID</span>
                  <span className={detailItemVal}>{emp.employee_id}</span>
                </div>
                <div className={detailItem}>
                  <span className={detailItemLbl}>Project</span>
                  <span className={detailItemVal}>{emp.project_name || 'Bench'}</span>
                </div>
                {full && (
                  <>
                    <div className={detailItem}>
                      <span className={detailItemLbl}>Email</span>
                      <span className={detailItemVal}>{full.email || '-'}</span>
                    </div>
                    <div className={detailItem}>
                      <span className={detailItemLbl}>Contact Number</span>
                      <span className={detailItemVal}>{full.contact_number || '-'}</span>
                    </div>
                    <div className={detailItem}>
                      <span className={detailItemLbl}>Joining Date</span>
                      <span className={detailItemVal}>{formatDate(full.joining_date)}</span>
                    </div>
                    <div className={detailItem}>
                      <span className={detailItemLbl}>Assignment Date</span>
                      <span className={detailItemVal}>{formatDate(full.project_assignment_date)}</span>
                    </div>
                    <div className={detailItem}>
                      <span className={detailItemLbl}>Project End Date</span>
                      <span className={detailItemVal}>{formatDate(full.project_end_date)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className={detailSection}>
              <h3 className={detailSectionHeading}>Technical Skills</h3>
              <div className={cx(detailSkillsList, !full && 'gap-2')}>
                {full ? (
                  <>
                    <div className={detailSkillRow}>
                      <strong>Primary: {full.primary_skill || 'Unspecified'}</strong>
                      <StarRating rating={full.primary_rating} />
                    </div>
                    <div className={detailSkillRow}>
                      <strong>Secondary: {full.secondary_skill || 'Unspecified'}</strong>
                      <StarRating rating={full.secondary_rating} />
                    </div>
                    <div className={detailSkillRow}>
                      <strong>Third: {full.third_skill || 'Unspecified'}</strong>
                      <StarRating rating={full.third_rating} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className={detailSkillRow}>
                      <strong>Primary:</strong> {emp.primary_skill || '-'}
                    </div>
                    <div className={detailSkillRow}>
                      <strong>Secondary:</strong> {emp.secondary_skill || '-'}
                    </div>
                    <div className={detailSkillRow}>
                      <strong>Third:</strong> {emp.third_skill || '-'}
                    </div>
                  </>
                )}
              </div>
            </div>

            {full && (
              <div className={detailSection}>
                <h3 className={detailSectionHeading}>Experience</h3>
                <div className={cx(detailSkillsList, 'gap-4')}>
                  <div className={detailItem}>
                    <span className={detailItemLbl}>Previous Exp</span>
                    <span className={detailItemVal}>{full.previous_exp || '-'}</span>
                  </div>
                  <div className={detailItem}>
                    <span className={detailItemLbl}>Arohak Exp</span>
                    <span className={detailItemVal}>{full.arohak_exp || '-'}</span>
                  </div>
                  <div className={cx(detailItem, 'col-span-2')}>
                    <span className={detailItemLbl}>Total Exp</span>
                    <span className={detailItemVal}>
                      {full.total_exp || monthsToString(parseExpToMonths(full.previous_exp) + parseExpToMonths(full.arohak_exp)) || '-'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className={detailSection}>
              <h3 className={detailSectionHeading}>Certifications</h3>
              {full ? (
                <div className={cx(detailSkillsList, 'gap-2.5')}>
                  <div className={detailItem}>
                    <span className={detailItemLbl}>Certificates</span>
                    <span className={cx(detailItemVal, detailItemValHighlight)}>{full.certifications || 'No certifications added.'}</span>
                  </div>
                  <div className={cx(detailRowGrid, 'mt-1.5')}>
                    <div className={detailItem}>
                      <span className={detailItemLbl}>Start / Year</span>
                      <span className={detailItemVal}>{full.cert_start_date || '-'}</span>
                    </div>
                    <div className={detailItem}>
                      <span className={detailItemLbl}>End Date</span>
                      <span className={detailItemVal}>{formatDate(full.cert_end_date)}</span>
                    </div>
                    <div className={cx(detailItem, 'col-span-2')}>
                      <span className={detailItemLbl}>Expiry</span>
                      <span className={detailItemVal}>{formatDate(full.expiry_date)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={detailItem}>
                  <span className={detailItemLbl}>Certificates</span>
                  <span className={cx(detailItemVal, detailItemValHighlight)}>{emp.certifications || 'No certifications.'}</span>
                </div>
              )}
            </div>

            <div className="mt-3 border-t border-border pt-4">
              <h3 className={detailSectionHeading}>Resumes</h3>
              <div className="flex gap-3 items-center flex-wrap mt-2">
                <button className={cx(btnSecondary, btnSm)} onClick={() => setResumeOpen(true)}>
                  <span className="material-icons-round text-[1.1rem]">visibility</span>
                  View Auto Resume
                </button>
                {emp.resume_path && (
                  <button className={cx(btnPrimary, btnSm)} onClick={handleDownloadUploaded}>
                    <span className="material-icons-round text-[1.1rem]">file_download</span>
                    Download Resume
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
      <ResumePreviewModal open={resumeOpen} onClose={() => setResumeOpen(false)} employeeId={employeeId} />
    </>
  );
}
