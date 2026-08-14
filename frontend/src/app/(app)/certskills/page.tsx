'use client';

import { StarRating } from '@/components/star-rating';
import { Spinner } from '@/components/spinner';
import { useApiData } from '@/lib/use-api-data';
import { formatDate, parseExpToYears } from '@/lib/format';
import {
  cx,
  pageHeaderRow,
  pageHeaderSubtitle,
  pageHeaderTitle,
  panel,
  panelBody,
  panelHeader,
  scheduleMetaItem,
  totalExpBadge,
} from '@/lib/ui';
import type { CertSkills } from '@/lib/types';

const certSkillsGrid = 'grid grid-cols-2 gap-6 max-[900px]:grid-cols-1';
const skillRatingBarRow = 'flex items-center gap-3 py-2.5 border-b border-border last:border-b-0';
const skillRatingBarLevel = 'w-[140px] h-1.5 bg-border rounded-full overflow-hidden shrink-0';
const skillRatingBarFill = 'h-full bg-gradient-to-r from-accent-primary to-accent-secondary rounded-full transition-[width] duration-[800ms] ease-[cubic-bezier(0.2,0.8,0.4,1)]';
const certItem = 'p-4 bg-[rgba(139,92,246,0.06)] border border-[rgba(139,92,246,0.18)] rounded-md flex items-center gap-2.5 [&_.material-icons-round]:text-accent-secondary';

export default function CertSkillsPage() {
  const { data, loading } = useApiData<CertSkills>('/api/certskills/me');

  const skills = data
    ? [
        { name: data.primary_skill, rating: data.primary_rating, label: 'Primary Skill' },
        { name: data.secondary_skill, rating: data.secondary_rating, label: 'Secondary Skill' },
        { name: data.third_skill, rating: data.third_rating, label: 'Third Skill' },
        { name: 'Work Experience Alignment', rating: data.work_exp_skills_rating, label: 'Work Exp Skill' },
      ].filter((s) => s.name && String(s.name).trim() !== '')
    : [];

  const certList = (data?.certifications || '').split(',').map((c) => c.trim()).filter(Boolean);

  const totalExpDisplay = data
    ? (() => {
        const sum = Math.round((parseExpToYears(data.previous_exp) + parseExpToYears(data.arohak_exp)) * 10) / 10;
        return sum > 0 ? `${sum.toFixed(1)} Years` : '0.0 Years';
      })()
    : '0.0 Years';

  return (
    <>
      <div className={pageHeaderRow}>
        <div>
          <h1 className={pageHeaderTitle}>Certifications &amp; Skills</h1>
          <p className={pageHeaderSubtitle}>A summary of your current skills, ratings, and active certifications.</p>
        </div>
      </div>

      {loading && (
        <div className="text-center flex flex-col items-center gap-3 py-[60px]">
          <Spinner />
          Loading…
        </div>
      )}

      {!loading && !data && <div className="text-text-muted p-10 text-center">No profile data available.</div>}

      {!loading && data && (
        <div className={certSkillsGrid}>
          <div className={panel}>
            <div className={panelHeader}>
              <span className="material-icons-round">psychology</span>
              <h2>Technical Skills &amp; Ratings</h2>
            </div>
            <div className={panelBody}>
              {skills.length === 0 ? (
                <p className="text-text-muted">No skills listed yet. Update your profile to add skills.</p>
              ) : (
                skills.map((s) => (
                  <div className={skillRatingBarRow} key={s.label}>
                    <span className="flex-1 text-sm font-medium text-text-primary">
                      {s.name} <span className="text-[0.72rem] text-text-muted font-normal">({s.label})</span>
                    </span>
                    <div className={skillRatingBarLevel}>
                      <div
                        className={skillRatingBarFill}
                        style={{ width: `${Math.min(100, Math.max(0, Math.round(((s.rating || 0) / 5) * 100)))}%` }}
                      />
                    </div>
                    <span className="text-[0.82rem] font-bold text-accent-secondary min-w-[28px] text-right">{(s.rating || 0).toFixed(1)}</span>
                  </div>
                ))
              )}
              <div className="mt-5 px-4 py-3.5 bg-bg-card border border-border rounded-md flex justify-between items-center">
                <span className="text-[0.85rem] font-semibold text-text-secondary">Overall Rating</span>
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5 text-warning">
                    <StarRating rating={data.overall_rating} />
                  </div>
                  <span className="font-bold text-accent-secondary">{(data.overall_rating || 0).toFixed(2)} / 5</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className={cx(panel, '!mb-5')}>
              <div className={panelHeader}>
                <span className="material-icons-round">workspace_premium</span>
                <h2>Certifications</h2>
              </div>
              <div className={panelBody}>
                {certList.length === 0 ? (
                  <p className="text-text-muted">No certifications on record.</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {certList.map((c) => (
                      <div className={certItem} key={c}>
                        <span className="material-icons-round">verified</span>
                        <div>
                          <div className="font-medium text-[0.88rem] text-text-primary">{c}</div>
                          {data.cert_start_date && <div className="text-xs text-text-muted mt-0.5">Completed: {data.cert_start_date}</div>}
                          {data.expiry_date && <div className="text-xs text-text-muted mt-0.5">Expires: {formatDate(data.expiry_date)}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className={panel}>
              <div className={panelHeader}>
                <span className="material-icons-round">history_edu</span>
                <h2>Experience Summary</h2>
              </div>
              <div className={cx(panelBody, 'flex flex-col gap-3')}>
                <div className={scheduleMetaItem}>
                  <span className="material-icons-round">work_history</span>
                  <div>
                    <div className="text-[0.72rem] text-text-muted mb-0.5">Previous Experience</div>
                    <strong>{data.previous_exp || 'Not documented'}</strong>
                  </div>
                </div>
                <div className={scheduleMetaItem}>
                  <span className="material-icons-round">corporate_fare</span>
                  <div>
                    <div className="text-[0.72rem] text-text-muted mb-0.5">Arohak Experience</div>
                    <strong>{data.arohak_exp || 'Not documented'}</strong>
                  </div>
                </div>
                <div className={totalExpBadge}>
                  <span className="material-icons-round">work_history</span>
                  <span>Total Experience: {totalExpDisplay}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
