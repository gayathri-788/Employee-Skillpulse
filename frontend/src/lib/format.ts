export function formatDate(dateString?: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function checkSixMonthsUpdate(lastUpdated?: string | null): boolean {
  if (!lastUpdated) return false;
  const last = new Date(lastUpdated);
  return Math.ceil(Math.abs(Date.now() - last.getTime()) / (1000 * 60 * 60 * 24)) >= 180;
}

export function parseExpToYears(expStr?: string | null): number {
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

export function parseExpToMonths(expStr?: string | null): number {
  return Math.round(parseExpToYears(expStr) * 12);
}

export function formatDecimalYears(years: number): string {
  if (!years || years <= 0) return '0.0 Years';
  return `${(Math.round(years * 10) / 10).toFixed(1)} Years`;
}

export function monthsToString(totalMonths: number): string {
  if (!totalMonths || totalMonths <= 0) return '0.0 Years';
  return formatDecimalYears(totalMonths / 12);
}
