'use client';

import type { MouseEvent } from 'react';

/** A toggle switch. Wraps a visually-hidden checkbox; click the label to toggle. */
export function Switch({
  checked,
  onChange,
  onClick,
}: {
  checked: boolean;
  onChange: () => void;
  onClick?: (e: MouseEvent<HTMLLabelElement>) => void;
}) {
  return (
    <label className="relative inline-block w-[50px] h-[26px] shrink-0 cursor-pointer" onClick={onClick}>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} />
      <span className="absolute inset-0 rounded-[34px] bg-border transition-[.4s] peer-checked:bg-accent-secondary peer-focus:shadow-[0_0_1px_var(--accent-secondary)] before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-1 before:bottom-1 before:bg-white before:rounded-full before:transition-[.4s] peer-checked:before:translate-x-6" />
    </label>
  );
}
