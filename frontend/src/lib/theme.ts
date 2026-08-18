export type Theme = 'dark' | 'light';

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: Theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
  localStorage.setItem('theme', theme);
}
