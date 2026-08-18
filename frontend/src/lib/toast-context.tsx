'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type ToastType = 'info' | 'warning' | 'error' | 'success';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextToastId = 0;

const ICONS: Record<ToastType, string> = {
  info: 'info',
  success: 'check_circle',
  warning: 'warning',
  error: 'error_outline',
};

const TOAST_ACCENT: Record<ToastType, string> = {
  success: 'border-l-success [&_.toast-icon]:text-success',
  warning: 'border-l-warning [&_.toast-icon]:text-warning',
  error: 'border-l-danger [&_.toast-icon]:text-danger',
  info: 'border-l-info [&_.toast-icon]:text-info',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++nextToastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div id="toast-container" className="fixed bottom-[30px] right-[30px] z-[2000] flex flex-col gap-2.5">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={`min-w-[300px] max-w-[420px] px-5 py-4 bg-bg-secondary border-l-4 rounded-sm shadow-lg flex items-center gap-3 text-text-primary ${TOAST_ACCENT[t.type]}`}
            >
              <span className="toast-icon material-icons-round text-[1.4rem]">{ICONS[t.type]}</span>
              <span className="text-sm font-medium">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
