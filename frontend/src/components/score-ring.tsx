'use client';

import { useEffect, useRef, useState } from 'react';

const CIRCUMFERENCE = 251.2;

/** Sweeps to 100% then eases down to the real score, matching the original app's ring animation. */
export function ScoreRing({ score, size = 100 }: { score: number; size?: number }) {
  const [offset, setOffset] = useState(CIRCUMFERENCE);
  const [displayValue, setDisplayValue] = useState(0);
  const [atFull, setAtFull] = useState(false);
  const frame = useRef(0);

  // Drives a two-phase rAF sweep/settle animation on score change — an external timer loop, not derived state.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelled = false;
    setAtFull(false);

    const toFullTimer = setTimeout(() => {
      const start = performance.now();
      function sweep(now: number) {
        if (cancelled) return;
        const progress = Math.min((now - start) / 600, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        setOffset(CIRCUMFERENCE - ease * CIRCUMFERENCE);
        setDisplayValue(Math.round(ease * 100));
        if (progress < 1) {
          frame.current = requestAnimationFrame(sweep);
        } else {
          setTimeout(() => {
            if (cancelled) return;
            setAtFull(true);
            const start2 = performance.now();
            function toTarget(now2: number) {
              if (cancelled) return;
              const progress2 = Math.min((now2 - start2) / 800, 1);
              const ease2 = 1 - Math.pow(1 - progress2, 3);
              const current = 100 - ease2 * (100 - score);
              setOffset(CIRCUMFERENCE - (current / 100) * CIRCUMFERENCE);
              setDisplayValue(Math.round(current));
              if (progress2 < 1) {
                frame.current = requestAnimationFrame(toTarget);
              } else {
                setDisplayValue(score);
              }
            }
            frame.current = requestAnimationFrame(toTarget);
          }, 150);
        }
      }
      frame.current = requestAnimationFrame(sweep);
    }, 50);

    return () => {
      cancelled = true;
      clearTimeout(toFullTimer);
      cancelAnimationFrame(frame.current);
    };
  }, [score]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const isPerfect = score === 100 && atFull;

  return (
    <div className="relative w-[100px] h-[100px] flex items-center justify-center" style={{ transform: 'scale(0.75)', transformOrigin: 'right center' }}>
      <svg className="-rotate-90" width={size} height={size}>
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        <circle
          stroke="rgba(15, 23, 42, 0.25)"
          strokeWidth={12}
          fill="transparent"
          r={40}
          cx={50}
          cy={50}
          className="[transform-origin:50%_50%]"
        />
        <circle
          stroke={isPerfect ? 'url(#scoreGradient)' : 'var(--accent-secondary)'}
          strokeWidth={12}
          fill="transparent"
          r={40}
          cx={50}
          cy={50}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="[transform-origin:50%_50%] transition-[stroke-dashoffset,stroke] duration-300 [transition-timing-function:cubic-bezier(0.25,1,0.5,1)]"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
        {isPerfect ? (
          <span className="bg-gradient-to-br from-[#10b981] to-[#34d399] bg-clip-text text-transparent font-['Outfit'] font-extrabold leading-none text-lg p-1">
            {displayValue}%
          </span>
        ) : (
          <span className="text-text-primary font-['Outfit'] font-extrabold leading-none text-[1.6rem] transition-colors duration-300">
            {displayValue}%
          </span>
        )}
        <span className="text-[0.65rem] text-text-secondary uppercase font-semibold mt-1 tracking-wide">Score</span>
      </div>
    </div>
  );
}
