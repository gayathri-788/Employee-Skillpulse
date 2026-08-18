'use client';

import { useMemo, useState } from 'react';
import { DonutChart } from '@/components/donut-chart';
import { Spinner } from '@/components/spinner';
import { buildDomainDistributionChart, buildSkillsByRatingChart, buildTopSkillsHeadcountChart } from '@/lib/dashboard-charts';
import { checkSixMonthsUpdate, formatDate } from '@/lib/format';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { useApiData } from '@/lib/use-api-data';
import {
  badgeWarning,
  btnSecondary,
  cx,
  pageHeaderRow,
  pageHeaderSubtitle,
  pageHeaderTitle,
  panel,
  panelBody,
  panelHeader,
  statCard,
  statIconBlue,
  statIconOrange,
  statIconPurple,
  statIconWrapper,
  statInfo,
  statLabel,
  statNumber,
  statsRow,
} from '@/lib/ui';
import type { Employee } from '@/lib/types';

const chartCard =
  'bg-[rgba(15,23,42,0.5)] border border-border rounded-md py-[22px] px-[18px] text-center flex flex-col items-center shadow-sm';
const chartCardHeader = 'w-full flex items-center justify-between mb-4 border-b border-dashed border-border pb-2.5';
const chartCardTitle = 'text-[0.95rem] m-0 flex items-center gap-1.5 font-semibold';
const chartCardBadgeBase = 'inline-flex items-center rounded-full text-[0.72rem] px-2 py-1 border';
const chartCardBadgeBlue = `${chartCardBadgeBase} bg-[rgba(96,165,250,0.15)] text-[#60a5fa] border-[rgba(96,165,250,0.3)]`;
const chartCardBadgePurple = `${chartCardBadgeBase} bg-[rgba(167,139,250,0.15)] text-[#a78bfa] border-[rgba(167,139,250,0.3)]`;
const chartCardBadgeGreen = `${chartCardBadgeBase} bg-[rgba(52,211,153,0.15)] text-[#34d399] border-[rgba(52,211,153,0.3)]`;

export default function AdminDashboardPage() {
  const { authedFetch } = useAuth();
  const { showToast } = useToast();
  const { data: employees, loading } = useApiData<Employee[]>('/api/employees');
  const [sendingReminders, setSendingReminders] = useState(false);

  const stats = useMemo(() => {
    const list = employees || [];
    const pending = list.filter((e) => checkSixMonthsUpdate(e.last_updated));
    const certified = list.filter((e) => e.certifications && e.certifications.trim()).length;
    return { total: list.length, pending, certified };
  }, [employees]);

  const ratingChart = useMemo(() => buildSkillsByRatingChart(employees || []), [employees]);
  const domainChart = useMemo(() => buildDomainDistributionChart(employees || []), [employees]);
  const headcountChart = useMemo(() => buildTopSkillsHeadcountChart(employees || []), [employees]);

  async function handleSendReminders() {
    setSendingReminders(true);
    try {
      const result = await authedFetch<{ detail: string; emails_sent: number }>('/api/admin/employees/send-reminders', { method: 'POST' });
      showToast(result.detail, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send reminders', 'error');
    } finally {
      setSendingReminders(false);
    }
  }

  return (
    <>
      <div className={pageHeaderRow}>
        <div>
          <h1 className={pageHeaderTitle}>Admin Dashboard</h1>
          <p className={pageHeaderSubtitle}>Arohak overview statistics, skill insights, and activity logs.</p>
        </div>
      </div>

      <div className={statsRow}>
        <div className={statCard}>
          <div className={cx(statIconWrapper, statIconPurple)}>
            <span className="material-icons-round">groups</span>
          </div>
          <div className={statInfo}>
            <span className={statLabel}>Total Employees</span>
            <span className={statNumber}>{loading ? '—' : stats.total}</span>
          </div>
        </div>
        <div className={statCard}>
          <div className={cx(statIconWrapper, statIconOrange)}>
            <span className="material-icons-round">mail_outline</span>
          </div>
          <div className={statInfo}>
            <span className={statLabel}>Pending Updates</span>
            <span className={statNumber}>{loading ? '—' : stats.pending.length}</span>
          </div>
        </div>
        <div className={statCard}>
          <div className={cx(statIconWrapper, statIconBlue)}>
            <span className="material-icons-round">verified</span>
          </div>
          <div className={statInfo}>
            <span className={statLabel}>Certified Talents</span>
            <span className={statNumber}>{loading ? '—' : stats.certified}</span>
          </div>
        </div>
      </div>

      <div className={cx(panel, 'mb-6')}>
        <div className={cx(panelHeader, 'justify-between')}>
          <div className="flex items-center gap-2.5">
            <span className="material-icons-round text-[#60a5fa] text-[1.6rem]">donut_large</span>
            <div>
              <h2 className="m-0 text-[1.15rem] font-semibold">Executive Technology &amp; Domain Insights</h2>
              <p className="mt-0.5 text-[0.8rem] text-text-muted">
                Real-time aggregated skill proficiency, domain allocation, and headcount distributions.
              </p>
            </div>
          </div>
        </div>
        <div className={panelBody}>
          {loading ? (
            <div className="text-center flex flex-col items-center gap-3 py-10">
              <Spinner />
              Loading analytics…
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(310px,1fr))] gap-6">
              <ChartCard icon="stars" iconClass="text-[#60a5fa]" title="Skillsets by Rating Sum" badge="Top 7 Skills" badgeClass={chartCardBadgeBlue}>
                <DonutChart data={ratingChart} unitLabel="pts" />
              </ChartCard>
              <ChartCard
                icon="domain"
                iconClass="text-[#a78bfa]"
                title="Arohak Domains Breakdown"
                badge={`${domainChart.labels.length} Domains`}
                badgeClass={chartCardBadgePurple}
              >
                <DonutChart data={domainChart} unitLabel="Employees" />
              </ChartCard>
              <ChartCard icon="groups" iconClass="text-[#34d399]" title="Top Skills Headcount" badge="Employee Count" badgeClass={chartCardBadgeGreen}>
                <DonutChart data={headcountChart} unitLabel="Employees" />
              </ChartCard>
            </div>
          )}
        </div>
      </div>

      <div className={panel}>
        <div className={cx(panelHeader, 'justify-between w-full')}>
          <div className="flex items-center gap-2">
            <span className="material-icons-round text-danger">notification_important</span>
            <h2>Employees Requiring Update Check</h2>
          </div>
          <button className={cx(btnSecondary, '!px-3 !py-1.5 !text-[0.85rem]')} disabled={sendingReminders} onClick={handleSendReminders}>
            <span className="material-icons-round text-lg">mail</span> {sendingReminders ? 'Sending…' : 'Send Reminders'}
          </button>
        </div>
        <div className={panelBody}>
          <div className="flex flex-col gap-3">
            {!loading && stats.pending.length === 0 && <div className="p-5 text-center text-success">All employee profiles are up to date!</div>}
            {stats.pending.map((emp) => (
              <div key={emp.employee_id} className="flex justify-between items-center px-3.5 py-2.5 border-b border-border">
                <div>
                  <strong className="text-text-primary text-[0.9rem]">{emp.name}</strong>
                  <span className="text-[0.8rem] text-text-muted ml-1.5">({emp.employee_id})</span>
                </div>
                <span className={cx(badgeWarning, '!text-[0.72rem]')}>Last Updated: {formatDate(emp.last_updated)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function ChartCard({
  icon,
  iconClass,
  title,
  badge,
  badgeClass,
  children,
}: {
  icon: string;
  iconClass: string;
  title: string;
  badge: string;
  badgeClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className={chartCard}>
      <div className={chartCardHeader}>
        <h3 className={chartCardTitle}>
          <span className={cx('material-icons-round text-[1.2rem]', iconClass)}>{icon}</span>
          {title}
        </h3>
        <span className={badgeClass}>{badge}</span>
      </div>
      <div className="relative w-full h-[280px] flex items-center justify-center">{children}</div>
    </div>
  );
}
