'use client';

import { Chart, type ChartConfiguration } from 'chart.js/auto';
import { useEffect, useRef } from 'react';
import type { DonutChartData } from '@/lib/dashboard-charts';

export function DonutChart({ data, unitLabel }: { data: DonutChartData; unitLabel: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    chartRef.current?.destroy();

    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: data.labels,
        datasets: [{ data: data.data, backgroundColor: data.colors, borderWidth: 2, borderColor: '#1e293b' }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        animation: { animateScale: true, animateRotate: true, duration: 800 },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#e2e8f0', font: { family: 'Inter', size: 10, weight: 500 }, boxWidth: 10, boxHeight: 10, padding: 12, usePointStyle: true },
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#ffffff',
            bodyColor: '#cbd5e1',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (ctx) => {
                const val = (ctx.raw as number) || 0;
                const pct = data.total > 0 ? ((val / data.total) * 100).toFixed(1) : '0.0';
                return ` ${ctx.label}: ${val} ${unitLabel} (${pct}%)`;
              },
            },
          },
        },
      },
    };

    chartRef.current = new Chart(ctx, config);
    return () => chartRef.current?.destroy();
  }, [data, unitLabel]);

  return <canvas ref={canvasRef} />;
}
