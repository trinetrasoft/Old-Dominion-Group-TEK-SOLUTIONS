/* Chart.js helpers — uses window.Chart from /vendor/chart.umd.min.js */

const PALETTE = {
  blue: '#0b5fff',
  blueSoft: 'rgba(11, 95, 255, 0.18)',
  blueFill: 'rgba(11, 95, 255, 0.12)',
  teal: '#0d9488',
  violet: '#4f46e5',
  emerald: '#059669',
  amber: '#d97706',
  rose: '#dc2626',
  slate: '#64748b',
  sky: '#0284c7',
  indigo: '#6366f1',
};

const STATUS_COLORS = [
  PALETTE.blue, PALETTE.teal, PALETTE.amber, PALETTE.violet,
  PALETTE.emerald, PALETTE.rose, PALETTE.sky, PALETTE.indigo, PALETTE.slate,
];

const registry = new Map();

function ChartCtor() {
  return window.Chart;
}

export function destroyCharts() {
  for (const c of registry.values()) {
    try { c.destroy(); } catch { /* ignore */ }
  }
  registry.clear();
}

function baseOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          pointStyle: 'circle',
          font: { family: 'Inter', size: 11 },
          color: '#64748b',
          padding: 14,
        },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleFont: { family: 'Inter', size: 12, weight: '600' },
        bodyFont: { family: 'Inter', size: 12 },
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
      },
    },
    ...extra,
  };
}

function scaleDefaults() {
  return {
    x: {
      grid: { color: 'rgba(15, 40, 80, 0.05)', drawBorder: false },
      ticks: { font: { family: 'Inter', size: 11 }, color: '#64748b' },
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(15, 40, 80, 0.06)', drawBorder: false },
      ticks: {
        font: { family: 'Inter', size: 11 },
        color: '#64748b',
        precision: 0,
      },
    },
  };
}

export function mountBarChart(canvasId, { labels, values, label = 'Count', color = PALETTE.blue }) {
  const Chart = ChartCtor();
  if (!Chart) return null;
  const el = document.getElementById(canvasId);
  if (!el) return null;
  const prev = registry.get(canvasId);
  if (prev) prev.destroy();

  const chart = new Chart(el, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label,
        data: values,
        backgroundColor: color,
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: 36,
      }],
    },
    options: {
      ...baseOptions(),
      scales: scaleDefaults(),
      plugins: {
        ...baseOptions().plugins,
        legend: { display: false },
      },
    },
  });
  registry.set(canvasId, chart);
  return chart;
}

export function mountPieChart(canvasId, { labels, values, doughnut = false }) {
  const Chart = ChartCtor();
  if (!Chart) return null;
  const el = document.getElementById(canvasId);
  if (!el) return null;
  const prev = registry.get(canvasId);
  if (prev) prev.destroy();

  const chart = new Chart(el, {
    type: doughnut ? 'doughnut' : 'pie',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: labels.map((_, i) => STATUS_COLORS[i % STATUS_COLORS.length]),
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 6,
      }],
    },
    options: {
      ...baseOptions(),
      cutout: doughnut ? '62%' : 0,
    },
  });
  registry.set(canvasId, chart);
  return chart;
}

export function mountAreaChart(canvasId, { labels, values, label = 'Trend' }) {
  const Chart = ChartCtor();
  if (!Chart) return null;
  const el = document.getElementById(canvasId);
  if (!el) return null;
  const prev = registry.get(canvasId);
  if (prev) prev.destroy();

  const chart = new Chart(el, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label,
        data: values,
        borderColor: PALETTE.blue,
        backgroundColor: PALETTE.blueFill,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: '#fff',
        pointBorderColor: PALETTE.blue,
        pointBorderWidth: 2,
        borderWidth: 2.5,
      }],
    },
    options: {
      ...baseOptions(),
      scales: scaleDefaults(),
    },
  });
  registry.set(canvasId, chart);
  return chart;
}

export function mountLineChart(canvasId, { labels, datasets }) {
  const Chart = ChartCtor();
  if (!Chart) return null;
  const el = document.getElementById(canvasId);
  if (!el) return null;
  const prev = registry.get(canvasId);
  if (prev) prev.destroy();

  const colors = [PALETTE.blue, PALETTE.teal, PALETTE.amber, PALETTE.violet];
  const chart = new Chart(el, {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map((ds, i) => ({
        label: ds.label,
        data: ds.values,
        borderColor: colors[i % colors.length],
        backgroundColor: 'transparent',
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: '#fff',
        pointBorderColor: colors[i % colors.length],
        pointBorderWidth: 2,
        borderWidth: 2.5,
      })),
    },
    options: {
      ...baseOptions(),
      scales: scaleDefaults(),
    },
  });
  registry.set(canvasId, chart);
  return chart;
}

export { PALETTE, STATUS_COLORS };
