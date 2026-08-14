'use client';

import type { ReactNode } from 'react';
import { ToastProvider } from '@/lib/toast-context';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeInit } from '@/components/theme-init';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <ThemeInit />
        {children}
      </AuthProvider>
    </ToastProvider>
  );
}
