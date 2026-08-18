import type { Employee } from './types';

export interface DonutChartData {
  labels: string[];
  data: number[];
  colors: string[];
  total: number;
}

const RATING_COLORS = ['#818cf8', '#60a5fa', '#fcd34d', '#34d399', '#fca5a5', '#c084fc', '#38bdf8'];
const DOMAIN_COLORS = ['#a5b4fc', '#2dd4bf', '#f472b6', '#fb7185', '#ff8a65', '#ffc107', '#6ee7b7', '#38bdf8', '#a78bfa', '#a3e635'];
const HEADCOUNT_COLORS = ['#67e8f9', '#ffab91', '#4ade80', '#93c5fd', '#ffe082', '#d8b4fe', '#f472b6'];

export function buildSkillsByRatingChart(employees: Employee[]): DonutChartData {
  const ratingMap: Record<string, number> = {};
  for (const emp of employees) {
    if (emp.primary_skill && (emp.primary_rating || 0) > 0) {
      const sk = emp.primary_skill.trim();
      ratingMap[sk] = (ratingMap[sk] || 0) + (emp.primary_rating || 0);
    }
    if (emp.secondary_skill && (emp.secondary_rating || 0) > 0) {
      const sk = emp.secondary_skill.trim();
      ratingMap[sk] = (ratingMap[sk] || 0) + (emp.secondary_rating || 0);
    }
    if (emp.third_skill && (emp.third_rating || 0) > 0) {
      const sk = emp.third_skill.trim();
      ratingMap[sk] = (ratingMap[sk] || 0) + (emp.third_rating || 0);
    }
  }
  const sorted = Object.keys(ratingMap)
    .sort((a, b) => ratingMap[b] - ratingMap[a])
    .slice(0, 7);
  const labels = sorted.length > 0 ? sorted : ['No Skills Added'];
  const data = sorted.length > 0 ? sorted.map((s) => Math.round(ratingMap[s])) : [0];
  return { labels, data, colors: RATING_COLORS.slice(0, labels.length), total: data.reduce((a, b) => a + b, 0) };
}

const DOMAIN_NAMES = ['DevOps', 'SAP', 'Full Stack', 'ServiceNow', 'AIML', 'HR', 'Accounts', 'Operations', 'Networking', 'Development'] as const;

export function buildDomainDistributionChart(employees: Employee[]): DonutChartData {
  const counts: Record<string, number> = Object.fromEntries(DOMAIN_NAMES.map((n) => [n, 0]));

  for (const emp of employees) {
    const text = `${emp.primary_skill || ''} ${emp.secondary_skill || ''} ${emp.third_skill || ''} ${emp.project_name || ''} ${emp.name || ''}`.toLowerCase();

    if (text.includes('devops') || text.includes('kubernetes') || text.includes('docker') || text.includes('ci/cd') || text.includes('jenkins')) {
      counts['DevOps']++;
    } else if (text.includes('sap') || text.includes('abap') || text.includes('hana') || text.includes('basis')) {
      counts['SAP']++;
    } else if (text.includes('servicenow') || text.includes('snow') || text.includes('itsm')) {
      counts['ServiceNow']++;
    } else if (
      text.includes('aiml') ||
      text.includes('ai') ||
      text.includes('ml') ||
      text.includes('machine learning') ||
      text.includes('nlp') ||
      text.includes('data science')
    ) {
      counts['AIML']++;
    } else if (text.includes('hr') || text.includes('human resource') || text.includes('recruitment') || text.includes('people')) {
      counts['HR']++;
    } else if (text.includes('account') || text.includes('finance') || text.includes('audit') || text.includes('billing')) {
      counts['Accounts']++;
    } else if (text.includes('operation') || text.includes('admin') || text.includes('support') || text.includes('helpdesk')) {
      counts['Operations']++;
    } else if (text.includes('network') || text.includes('cisco') || text.includes('security') || text.includes('ccna') || text.includes('firewall')) {
      counts['Networking']++;
    } else if (
      text.includes('full stack') ||
      text.includes('fullstack') ||
      (text.includes('react') && text.includes('java')) ||
      (text.includes('angular') && text.includes('node'))
    ) {
      counts['Full Stack']++;
    } else {
      counts['Development']++;
    }
  }

  const active = DOMAIN_NAMES.filter((k) => counts[k] > 0);
  const labels = active.length > 0 ? [...active] : ['No Domain Data'];
  const data = active.length > 0 ? active.map((k) => counts[k]) : [0];
  return { labels, data, colors: DOMAIN_COLORS.slice(0, labels.length), total: data.reduce((a, b) => a + b, 0) };
}

export function buildTopSkillsHeadcountChart(employees: Employee[]): DonutChartData {
  const countMap: Record<string, number> = {};
  for (const emp of employees) {
    for (const sk of [emp.primary_skill, emp.secondary_skill, emp.third_skill]) {
      if (sk && sk.trim()) {
        const clean = sk.trim();
        countMap[clean] = (countMap[clean] || 0) + 1;
      }
    }
  }
  const sorted = Object.keys(countMap)
    .sort((a, b) => countMap[b] - countMap[a])
    .slice(0, 7);
  const labels = sorted.length > 0 ? sorted : ['No Skills Added'];
  const data = sorted.length > 0 ? sorted.map((s) => countMap[s]) : [0];
  return { labels, data, colors: HEADCOUNT_COLORS.slice(0, labels.length), total: data.reduce((a, b) => a + b, 0) };
}
