'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Switch } from '@/components/switch';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { applyTheme, getStoredTheme, type Theme } from '@/lib/theme';
import {
  btnPrimary,
  btnSecondary,
  colSpan2,
  cx,
  formGroup,
  gridTwo,
  panel,
  panelBody,
  panelHeader,
  panelHelperText,
  pageHeaderRow,
  pageHeaderSubtitle,
  pageHeaderTitle,
} from '@/lib/ui';

const themeToggleActive = '!bg-accent-secondary !text-[#0a0a0a] !border-accent-secondary shadow-[0_4px_12px_rgba(245,158,11,0.3)]';

export default function SettingsPage() {
  const { authedFetch } = useAuth();
  const { showToast } = useToast();
  const [theme, setThemeState] = useState<Theme>('dark');
  const [notifications, setNotifications] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Hydrate from localStorage on mount (client-only external store).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setThemeState(getStoredTheme());
    setNotifications(localStorage.getItem('notificationsEnabled') !== 'false');
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function chooseTheme(next: Theme) {
    applyTheme(next);
    setThemeState(next);
    showToast(`${next === 'dark' ? 'Dark' : 'Light'} mode activated`, 'success');
  }

  function toggleNotifications(checked: boolean) {
    setNotifications(checked);
    localStorage.setItem('notificationsEnabled', String(checked));
    showToast(`Email notifications ${checked ? 'enabled' : 'disabled'}`, 'info');
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    setChangingPassword(true);
    try {
      await authedFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      showToast('Password changed successfully!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to change password', 'error');
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <>
      <div className={pageHeaderRow}>
        <div>
          <h1 className={pageHeaderTitle}>Portal Settings</h1>
          <p className={pageHeaderSubtitle}>Manage your notifications, change password, and theme preferences.</p>
        </div>
      </div>

      <div className={panel}>
        <div className={panelHeader}>
          <span className="material-icons-round">notifications</span>
          <h2>Notification Preferences</h2>
        </div>
        <div className={panelBody}>
          <div className={cx(formGroup, '!mb-0 flex items-center gap-3')}>
            <Switch checked={notifications} onChange={() => toggleNotifications(!notifications)} />
            <div>
              <h3 className="text-[0.95rem] mb-0.5 text-text-primary">Enable Email Notifications</h3>
              <p className="text-[0.8rem] text-text-muted">
                Receive automatic alerts on portal updates and 6-month profile refresh periods.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className={panel}>
        <div className={panelHeader}>
          <span className="material-icons-round">palette</span>
          <h2>Visual Theme Preferences</h2>
        </div>
        <div className={panelBody}>
          <p className={panelHelperText}>Select your preferred color theme for the portal.</p>
          <div className="flex gap-4">
            <button
              type="button"
              className={cx(btnSecondary, theme === 'dark' && themeToggleActive)}
              onClick={() => chooseTheme('dark')}
            >
              <span className="material-icons-round">dark_mode</span>
              <span>Dark Mode</span>
            </button>
            <button
              type="button"
              className={cx(btnSecondary, theme === 'light' && themeToggleActive)}
              onClick={() => chooseTheme('light')}
            >
              <span className="material-icons-round">light_mode</span>
              <span>Light Mode</span>
            </button>
          </div>
        </div>
      </div>

      <div className={panel}>
        <div className={panelHeader}>
          <span className="material-icons-round">lock</span>
          <h2>Account Security</h2>
        </div>
        <form onSubmit={handlePasswordChange}>
          <div className={cx(panelBody, gridTwo, '!pb-0')}>
            <div className={formGroup}>
              <label htmlFor="settings-pass-current">Current Password</label>
              <input
                type="password"
                id="settings-pass-current"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className={formGroup}>
              <label htmlFor="settings-pass-new">New Password</label>
              <input
                type="password"
                id="settings-pass-new"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className={cx(formGroup, colSpan2)}>
              <label htmlFor="settings-pass-confirm">Confirm New Password</label>
              <input
                type="password"
                id="settings-pass-confirm"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end px-6 pb-6">
            <button type="submit" className={btnPrimary} disabled={changingPassword}>
              <span className="material-icons-round">vpn_key</span>
              <span>{changingPassword ? 'Changing…' : 'Change Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
