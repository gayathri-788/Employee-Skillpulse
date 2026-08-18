'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useAvatar } from '@/lib/use-avatar';
import { PageTransition } from '@/components/page-transition';
import { badgeAdmin, badgeEmployee, cx } from '@/lib/ui';

interface NavItem {
  href: string;
  icon: string;
  label: string;
}

const EMPLOYEE_NAV: NavItem[] = [
  { href: '/directory', icon: 'people_outline', label: 'Employee Directory' },
  { href: '/attendance', icon: 'event_available', label: 'Attendance' },
  { href: '/schedule', icon: 'calendar_month', label: 'Weekly Schedule' },
  { href: '/certskills', icon: 'workspace_premium', label: 'Certifications & Skills' },
  { href: '/skilltargets', icon: 'flag', label: 'Employee Growth Targets' },
  { href: '/talents', icon: 'sports_soccer', label: 'Talents & Activities' },
  { href: '/timesheet', icon: 'schedule', label: 'Weekly Timesheet' },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/admin/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/admin/directory', icon: 'badge', label: 'Employees Directory' },
  { href: '/admin/attendance', icon: 'event_note', label: 'Attendance Tracker' },
  { href: '/admin/assets', icon: 'devices', label: 'Office Assets' },
  { href: '/admin/skilltargets', icon: 'track_changes', label: 'Employee Growth Targets' },
  { href: '/admin/timesheets', icon: 'rule', label: 'Timesheet Approvals' },
  { href: '/admin/emp-timesheets', icon: 'view_timeline', label: 'Employee Timesheets' },
  { href: '/admin/projects', icon: 'account_tree', label: 'Projects & Teams' },
];

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cx(
        'relative flex items-center gap-3 w-full px-4 py-3 rounded-md text-[0.95rem] text-left no-underline transition-colors duration-150',
        active
          ? 'text-border-focus border-l-[3px] border-accent-primary rounded-l-none'
          : 'text-text-secondary hover:bg-bg-tertiary hover:text-accent-primary'
      )}
    >
      {active && (
        <motion.span
          layoutId="active-nav-pill"
          className="absolute inset-0 z-0 bg-accent-glow rounded-[inherit]"
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        />
      )}
      <span className="material-icons-round relative z-10 text-[1.3rem]">{item.icon}</span>
      <span className="relative z-10 font-medium">{item.label}</span>
    </Link>
  );
}

function SignOutButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-3 rounded-md text-[0.95rem] text-left transition-colors duration-150 text-[#f87171] hover:bg-[rgba(239,68,68,0.1)]"
    >
      <span className="material-icons-round text-[1.3rem]">logout</span>
      <span className="font-medium">Sign Out</span>
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { token, role, username, isReady, logout, authedFetch } = useAuth();
  const { avatarUrl } = useAvatar(username);
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (isReady && !token) {
      router.replace('/login');
    }
  }, [isReady, token, router]);

  // Close the mobile drawer whenever the route changes.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Fetch the employee's real name for the header (admins have no employee record).
  useEffect(() => {
    if (role !== 'employee') return;
    let cancelled = false;
    authedFetch<{ name: string }>('/api/employees/me')
      .then((emp) => {
        if (!cancelled) setDisplayName(emp.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- authedFetch identity changes shouldn't refetch
  }, [role]);

  if (!isReady || !token) return null;

  const navItems = role === 'admin' ? ADMIN_NAV : EMPLOYEE_NAV;
  const headerName = role === 'admin' ? 'System Administrator' : displayName || username;

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen flex flex-col">
      <motion.header
        className="h-[70px] bg-bg-header backdrop-blur-[10px] border-b border-border px-4 sm:px-6 lg:px-[30px] flex items-center justify-between gap-2 sticky top-0 z-[100] shadow-sm overflow-hidden"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <button
            type="button"
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-md text-text-secondary hover:bg-bg-tertiary hover:text-accent-primary transition-colors"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle navigation menu"
          >
            <span className="material-icons-round">menu</span>
          </button>
          <Image src="/logo.png" alt="Arohak Logo" width={40} height={40} className="h-7 w-auto object-contain shrink-0" />
          <span className={cx(role === 'admin' ? badgeAdmin : badgeEmployee, '!hidden sm:!inline-flex shrink-0')}>
            {role === 'admin' ? 'Admin' : 'Employee'}
          </span>
        </div>
        <div className="flex items-center gap-2.5 min-w-0 shrink justify-end">
          <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center bg-bg-tertiary border-2 border-border shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data: URL avatar, next/image can't optimize it
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="material-icons-round text-[2.2rem] text-text-secondary">account_circle</span>
            )}
          </div>
          <div className="flex flex-col min-w-0 max-w-[110px] sm:max-w-[200px]">
            <span className="text-sm font-semibold text-text-primary truncate">{headerName}</span>
            <span className="text-xs text-text-muted truncate">{username.toUpperCase()}</span>
          </div>
        </div>
      </motion.header>

      <div className="flex flex-1 min-h-[calc(100vh-70px)] relative">
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              className="fixed inset-0 top-[70px] z-[105] bg-black/50 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        <aside
          className={cx(
            'w-[260px] bg-bg-secondary border-r border-border p-4 py-6 shrink-0 flex flex-col justify-between overflow-y-auto',
            'fixed left-0 top-[70px] bottom-0 z-[110] transition-transform duration-300 ease-in-out',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
            'lg:translate-x-0 lg:z-auto lg:sticky lg:top-[70px] lg:bottom-auto lg:self-start lg:h-[calc(100dvh-70px)]'
          )}
        >
          <nav className="flex flex-col gap-1.5">
            <div>
              <div className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-text-muted px-4 pt-4 pb-1.5 mt-1">
                {role === 'admin' ? 'Admin Panel' : 'My Portal'}
              </div>
              {navItems.map((item) => (
                <NavLink key={item.href} item={item} onNavigate={() => setSidebarOpen(false)} />
              ))}
            </div>
          </nav>
          <div className="border-t border-border pt-4 mt-4 flex flex-col gap-1.5">
            {role !== 'admin' && (
              <NavLink
                item={{ href: '/profile', icon: 'person_outline', label: 'My Profile' }}
                onNavigate={() => setSidebarOpen(false)}
              />
            )}
            <NavLink item={{ href: '/settings', icon: 'settings', label: 'Settings' }} onNavigate={() => setSidebarOpen(false)} />
            <SignOutButton onClick={handleLogout} />
          </div>
        </aside>

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-10 max-w-[1200px] mx-auto w-full">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
