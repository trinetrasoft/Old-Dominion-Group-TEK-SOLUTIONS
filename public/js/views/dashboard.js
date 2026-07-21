import { esc } from '../api.js';
import { shell, showSkeleton } from '../shell.js';
import { pageHeader } from '../ui/page-header.js';
import { skeletonDashboard } from '../ui/skeleton.js';
import { badge } from '../ui/badge.js';
import { icon } from '../icons.js';
import { loadExecutiveData } from '../dashboard-data.js';
import {
  destroyCharts,
  mountBarChart,
  mountPieChart,
  mountAreaChart,
  mountLineChart,
} from '../ui/charts.js';

function execKpi(c) {
  const deltaClass = c.deltaTone === 'warn' ? 'warn' : c.deltaTone === 'danger' ? 'danger' : '';
  return `
  <article class="dash-kpi tone-${esc(c.tone || 'blue')}">
    <div class="kpi-top">
      <div class="kpi-icon">${icon(c.icon || 'trending-up')}</div>
      ${c.delta ? `<span class="kpi-delta ${deltaClass}">${esc(c.delta)}</span>` : ''}
    </div>
    <div class="kpi-value">${esc(c.value)}</div>
    <div class="kpi-label">${esc(c.label)}</div>
  </article>`;
}

function chartCard(id, title, span = '') {
  return `
  <div class="chart-card ${span}">
    <div class="chart-card-head"><h4>${esc(title)}</h4></div>
    <div class="chart-card-body"><canvas id="${id}" aria-label="${esc(title)}"></canvas></div>
  </div>`;
}

function listWidget(title, iconName, items, empty, renderItem) {
  return `
  <section class="widget">
    <div class="widget-head">
      <h4>${icon(iconName, 'icon icon-sm')} ${esc(title)}</h4>
    </div>
    <div class="widget-body">
      ${items?.length
        ? `<ul class="activity-list">${items.map(renderItem).join('')}</ul>`
        : `<div class="widget-empty">${esc(empty)}</div>`}
    </div>
  </section>`;
}

function activityItem(it) {
  return `
  <li class="activity-item">
    <div class="activity-dot ${esc(it.tone || '')}">${icon(it.tone === 'danger' ? 'alert-circle' : it.tone === 'ok' ? 'check-circle-2' : 'circle-dot', 'icon icon-sm')}</div>
    <div>
      <div class="item-title">${esc(it.title)}</div>
      <div class="item-sub">${esc(it.sub || '')}</div>
    </div>
    <div class="item-meta">${esc(it.when || '')}</div>
  </li>`;
}

function approvalItem(it) {
  return `
  <li class="approval-item">
    <div class="activity-dot ${esc(it.tone || '')}">${icon('shield-check', 'icon icon-sm')}</div>
    <div>
      <div class="item-title">${esc(it.title)}</div>
      <div class="item-sub">${esc(it.sub || '')}</div>
    </div>
    <div class="item-meta">${it.status ? badge(it.status) : esc(it.when || '')}</div>
  </li>`;
}

function projectItem(it) {
  return `
  <li class="project-mini">
    <div>
      <div class="item-title">${esc(it.title)} ${it.status ? badge(it.status) : ''}</div>
      <div class="item-sub">${esc(it.sub || '')}</div>
    </div>
    <div class="item-meta tabular">${esc(it.value || '')}</div>
  </li>`;
}

function taskItem(it) {
  const href = it.href || '#/dashboard';
  return `
  <li class="task-item">
    <div class="task-icon ${esc(it.tone || 'warn')}">${icon('clipboard-list', 'icon icon-sm')}</div>
    <div>
      <div class="item-title"><a href="${href}">${esc(it.title)}</a></div>
      <div class="item-sub">${esc(it.sub || '')}</div>
    </div>
    <div class="item-meta">${esc(it.when || '')}</div>
  </li>`;
}

function scheduleItem(it) {
  return `
  <li class="schedule-item">
    <div class="sched-icon ${esc(it.tone || '')}">${icon('calendar', 'icon icon-sm')}</div>
    <div>
      <div class="item-title">${esc(it.title)}</div>
      <div class="item-sub">${esc(it.sub || '')}</div>
    </div>
    <div class="item-meta">${esc(it.when || '')}</div>
  </li>`;
}

function mountAllCharts(charts) {
  if (!charts) return;
  destroyCharts();

  if (charts.rfqPipeline?.labels?.length) {
    mountBarChart('chart-rfq', { ...charts.rfqPipeline, label: 'RFQs' });
  }
  if (charts.bidPipeline?.labels?.length) {
    mountBarChart('chart-bids', { ...charts.bidPipeline, label: 'Bids', color: '#0d9488' });
  }
  if (charts.vendorPipeline?.labels?.length) {
    mountPieChart('chart-vendors', charts.vendorPipeline);
  }
  if (charts.projectStatus?.labels?.length) {
    mountPieChart('chart-projects', { ...charts.projectStatus, doughnut: true });
  }
  if (charts.invoiceStatus?.labels?.length) {
    mountPieChart('chart-invoices', { ...charts.invoiceStatus, doughnut: true });
  }
  if (charts.revenueArea?.labels?.length) {
    mountAreaChart('chart-revenue', charts.revenueArea);
  }
  if (charts.activityLine?.labels?.length) {
    mountLineChart('chart-activity', charts.activityLine);
  }
}

export async function viewDashboard() {
  showSkeleton(
    pageHeader('Executive Dashboard', 'Operations performance at a glance')
    + skeletonDashboard()
  );

  const data = await loadExecutiveData();
  const { kpis, charts, widgets } = data;

  if (data.vendor) {
    shell(`
      ${pageHeader('Vendor Dashboard', 'Your solicitations and quote activity')}
      <div class="dash-kpis">${kpis.map(execKpi).join('')}</div>
      <div class="dash-lower-wide">
        ${listWidget('Activity', 'activity', widgets.activity, 'No recent activity', activityItem)}
        ${listWidget('Pending Tasks', 'clipboard-list', widgets.tasks, 'You are all caught up', taskItem)}
      </div>
      <div class="dash-lower-wide">
        ${listWidget("Today's Schedule", 'calendar', widgets.schedule, 'Nothing due soon', scheduleItem)}
        ${listWidget('Open Packages', 'send', widgets.activity, 'No open solicitations', activityItem)}
      </div>
    `, { title: 'Dashboard' });
    return;
  }

  shell(`
    ${pageHeader('Executive Dashboard', 'Revenue, pipeline health, approvals, and operational risk')}
    <div class="dash-kpis" role="region" aria-label="Key performance indicators">
      ${kpis.map(execKpi).join('')}
    </div>

    <section class="dash-section">
      <div class="dash-section-head">
        <h3>Operations Overview</h3>
        <span class="hint">Pipelines and status distribution</span>
      </div>
      <div class="dash-charts">
        ${chartCard('chart-rfq', 'RFQ Pipeline', 'span-3')}
        ${chartCard('chart-bids', 'Bid Pipeline', 'span-3')}
        ${chartCard('chart-vendors', 'Vendor Pipeline')}
        ${chartCard('chart-projects', 'Project Status')}
        ${chartCard('chart-invoices', 'Invoice Status')}
        ${chartCard('chart-revenue', 'Revenue Trend (Area)', 'span-3')}
        ${chartCard('chart-activity', 'Volume Trend (Line)', 'span-3')}
      </div>
    </section>

    <div class="dash-lower">
      ${listWidget('Activity Timeline', 'activity', widgets.activity, 'No recent activity', activityItem)}
      ${listWidget('Recent Approvals', 'shield-check', widgets.approvals, 'No approval activity yet', approvalItem)}
      ${listWidget('Recent Projects', 'folder-kanban', widgets.projects, 'No projects yet', projectItem)}
    </div>

    <div class="dash-lower-wide">
      ${listWidget('Pending Tasks', 'clipboard-list', widgets.tasks, 'No pending tasks — nice work', taskItem)}
      ${listWidget("Today's Schedule", 'calendar', widgets.schedule, 'No upcoming due dates', scheduleItem)}
    </div>
  `, { title: 'Dashboard' });

  // Charts need DOM; mount after shell paints
  requestAnimationFrame(() => mountAllCharts(charts));
}
