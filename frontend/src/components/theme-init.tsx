'use client';

import { useEffect } from 'react';
import { applyTheme, getStoredTheme } from '@/lib/theme';

/** Applies the persisted theme to <body> on first client render. Renders nothing. */
export function ThemeInit() {
  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);
  return null;
}
