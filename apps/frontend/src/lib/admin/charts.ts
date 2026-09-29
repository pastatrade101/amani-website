/* eslint-disable @typescript-eslint/no-explicit-any */
// Brand-styled Chart.js config presets. Each returns { type, data, options }
// ready to spread into <ChartCanvas {...cfg} />. Labels/grids use a neutral gray
// that reads on both light and dark surfaces.

export const CHART_PALETTE = ['#F4CE24', '#123252', '#31516F', '#94a3b8', '#AA3D1D', '#FFF4BF', '#638FAC', '#f87171'];
const GOLD = '#F4CE24';
const FOREST = '#123252';
const TICK = '#94a3b8';
const GRID = 'rgba(148,163,184,0.16)';
const ANIM = { duration: 850, easing: 'easeOutQuart' as const };

export type Pt = { label: string; value: number };

// Vertical gold gradient for area fills.
const vGradient = (from: string, to: string) => (ctx: any) => {
  const { chart } = ctx;
  const area = chart?.chartArea;
  if (!area) return from;
  const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  return g;
};

// Horizontal forest→gold gradient for bars.
const hGradient = (ctx: any) => {
  const { chart } = ctx;
  const area = chart?.chartArea;
  if (!area) return FOREST;
  const g = chart.ctx.createLinearGradient(area.left, 0, area.right, 0);
  g.addColorStop(0, FOREST);
  g.addColorStop(1, GOLD);
  return g;
};

export const doughnutConfig = (rows: Pt[], unit = '') => ({
  type: 'doughnut' as const,
  data: {
    labels: rows.map((r) => r.label),
    datasets: [{ data: rows.map((r) => r.value), backgroundColor: CHART_PALETTE, borderColor: 'rgba(0,0,0,0)', borderWidth: 2, hoverOffset: 10 }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '64%',
    animation: { ...ANIM, animateRotate: true, animateScale: true },
    plugins: {
      legend: { position: 'bottom', labels: { color: TICK, usePointStyle: true, pointStyle: 'circle', padding: 14, font: { weight: 600 } } },
      tooltip: { callbacks: { label: (c: any) => ` ${c.label}: ${c.parsed}${unit}` } },
      datalabels: { display: false }
    }
  }
});

export const lineConfig = (labels: string[], values: number[], unit = '') => ({
  type: 'line' as const,
  data: {
    labels,
    datasets: [{
      data: values,
      borderColor: GOLD,
      borderWidth: 3,
      tension: 0.4,
      fill: true,
      backgroundColor: vGradient('rgba(244,206,36,0.35)', 'rgba(244,206,36,0.02)'),
      pointRadius: values.length > 31 ? 0 : 3,
      pointHoverRadius: 5,
      pointBackgroundColor: GOLD,
      pointBorderColor: '#ffffff',
      pointBorderWidth: 1.5
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: ANIM,
    interaction: { intersect: false, mode: 'index' as const },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c: any) => ` ${c.parsed.y}${unit}` } },
      datalabels: { display: false }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: TICK, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
      y: { beginAtZero: true, grid: { color: GRID }, ticks: { color: TICK, precision: 0 } }
    }
  }
});

export const barConfig = (rows: Pt[], opts: { horizontal?: boolean; unit?: string } = {}) => {
  const horizontal = opts.horizontal ?? false;
  const unit = opts.unit ?? '';
  return {
    type: 'bar' as const,
    data: {
      labels: rows.map((r) => r.label),
      datasets: [{ data: rows.map((r) => r.value), backgroundColor: horizontal ? hGradient : FOREST, hoverBackgroundColor: GOLD, borderRadius: 6, maxBarThickness: 30 }]
    },
    options: {
      indexAxis: horizontal ? ('y' as const) : ('x' as const),
      responsive: true,
      maintainAspectRatio: false,
      animation: ANIM,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c: any) => ` ${horizontal ? c.parsed.x : c.parsed.y}${unit}` } },
        datalabels: { display: false }
      },
      scales: {
        x: { beginAtZero: true, grid: { display: horizontal, color: GRID }, ticks: { color: TICK, precision: 0 } },
        y: { beginAtZero: true, grid: { display: !horizontal, color: GRID }, ticks: { color: TICK, precision: 0 } }
      }
    }
  };
};

// Funnel = descending horizontal bars with the value labelled at the bar end.
export const funnelConfig = (stages: Pt[]) => ({
  type: 'bar' as const,
  data: {
    labels: stages.map((s) => s.label),
    datasets: [{ data: stages.map((s) => s.value), backgroundColor: hGradient, borderRadius: 8, maxBarThickness: 34 }]
  },
  options: {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 1000, easing: 'easeOutQuart' as const },
    layout: { padding: { right: 28 } },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
      datalabels: { display: true, anchor: 'end' as const, align: 'end' as const, color: TICK, font: { weight: 700 }, formatter: (v: number) => v }
    },
    scales: {
      x: { display: false, beginAtZero: true, grace: '12%' },
      y: { grid: { display: false }, ticks: { color: TICK, font: { weight: 600 } } }
    }
  }
});
