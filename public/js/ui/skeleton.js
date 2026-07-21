export function skeletonDashboard() {
  return `
  <div class="route-loading skeleton-stack">
    <div class="dash-kpis">
      ${[1, 2, 3, 4, 5, 6].map(() => '<div class="skeleton skeleton-card"></div>').join('')}
    </div>
    <div class="dash-charts">
      ${[1, 2, 3, 4].map(() => '<div class="skeleton skeleton-card" style="height:240px;grid-column:span 1"></div>').join('')}
    </div>
    <div class="dash-lower">
      ${[1, 2, 3].map(() => '<div class="skeleton skeleton-card" style="height:280px"></div>').join('')}
    </div>
  </div>`;
}

export function skeletonTable(rows = 6) {
  return `
  <div class="route-loading panel">
    <div class="panel-body skeleton-stack">
      <div class="skeleton skeleton-line w-40"></div>
      ${Array.from({ length: rows }, () => '<div class="skeleton skeleton-row"></div>').join('')}
    </div>
  </div>`;
}

export function skeletonPage() {
  return `
  <div class="route-loading skeleton-stack">
    <div class="skeleton skeleton-line w-40" style="height:28px"></div>
    <div class="skeleton skeleton-line w-60"></div>
    ${skeletonTable(5)}
  </div>`;
}
