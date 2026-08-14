'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { btnBlock, btnPrimary, cx, formGroup } from '@/lib/ui';

export default function LoginPage() {
  const { token, role, isReady, login } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isReady && token) {
      router.replace(role === 'admin' ? '/admin/dashboard' : '/profile');
    }
  }, [isReady, token, role, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(username, password);
      showToast('Signed in successfully!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Login failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-bg-primary">
      <motion.div
        className="w-full max-w-[440px] p-10 bg-bg-card backdrop-blur-2xl border border-border rounded-lg shadow-lg relative overflow-hidden"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent-primary to-accent-secondary" />
        <div className="text-center mb-[30px]">
          <div className="inline-flex items-center justify-center mb-5 bg-bg-logo-container px-6 py-3 rounded-md border border-border">
            <Image src="/logo.png" alt="Arohak Logo" width={72} height={72} className="h-12 w-auto object-contain" />
          </div>
          <h1 className="text-[1.8rem] mb-2">Skills &amp; Details Portal</h1>
          <p className="text-text-secondary text-sm">Enter your credentials to access the employee portal.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={formGroup}>
            <label htmlFor="login-username">Employee ID / Username</label>
            <div className="relative">
              <span className="material-icons-round absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-xl">
                person
              </span>
              <input
                type="text"
                id="login-username"
                placeholder="e.g. AT0123 or admin"
                required
                autoComplete="username"
                className="pl-11"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>
          <div className={formGroup}>
            <label htmlFor="login-password">Password</label>
            <div className="relative">
              <span className="material-icons-round absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-xl">
                lock
              </span>
              <input
                type="password"
                id="login-password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="pl-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <motion.button
            whileHover={{ scale: submitting ? 1 : 1.015 }}
            whileTap={{ scale: submitting ? 1 : 0.98 }}
            type="submit"
            className={cx(btnPrimary, btnBlock)}
            disabled={submitting}
          >
            <span>{submitting ? 'Signing In…' : 'Sign In'}</span>
            <span className="material-icons-round">arrow_forward</span>
          </motion.button>
        </form>
        <div className="mt-6 text-center text-xs text-text-muted">
          <p>
            Default password for seeded profiles is{' '}
            <code className="bg-bg-input-disabled px-1.5 py-0.5 rounded text-text-secondary">Password@123</code>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
