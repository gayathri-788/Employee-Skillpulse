'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cx } from '@/lib/ui';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md';
}) {
  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-5 bg-[rgba(15,23,42,0.4)] backdrop-blur-[8px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            className={cx(
              'relative bg-bg-secondary border border-border rounded-lg w-full shadow-lg max-h-[90vh] flex flex-col',
              size === 'sm' ? 'max-w-[420px]' : 'max-w-[760px]'
            )}
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {title && (
              <div className="px-6 py-5 border-b border-border flex items-center justify-between">
                <h2>{title}</h2>
                <button
                  type="button"
                  className="bg-transparent border-none text-text-secondary cursor-pointer inline-flex p-1 rounded-full hover:bg-black/5 hover:text-accent-primary"
                  onClick={onClose}
                >
                  <span className="material-icons-round">close</span>
                </button>
              </div>
            )}
            <div className="p-6 overflow-y-auto flex-1">{children}</div>
            {footer && <div className="px-6 py-4 border-t border-border flex justify-end gap-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
