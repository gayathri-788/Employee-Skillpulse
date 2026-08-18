'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

export default function RootPage() {
  const { token, role, isReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    if (!token) {
      router.replace('/login');
    } else {
      router.replace(role === 'admin' ? '/admin/dashboard' : '/profile');
    }
  }, [isReady, token, role, router]);

  return null;
}
