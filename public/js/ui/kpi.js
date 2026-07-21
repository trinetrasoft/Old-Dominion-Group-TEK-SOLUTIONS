import { icon } from '../icons.js';
import { esc } from '../api.js';

const DEFAULT_ICONS = ['trending-up', 'briefcase', 'file-text', 'users', 'folder-kanban', 'dollar-sign', 'clipboard-list', 'shield-check'];

export function kpiGrid(cards) {
  if (!cards?.length) return '';
  return `<div class="kpi-grid">${cards.map((c, i) => kpiCard(c, DEFAULT_ICONS[i % DEFAULT_ICONS.length])).join('')}</div>`;
}

export function kpiCard(c, iconName = 'trending-up') {
  return `
  <div class="kpi-card">
    <div class="kpi-top">
      <div class="kpi-icon">${icon(c.icon || iconName, 'icon')}</div>
    </div>
    <div class="kpi-value">${esc(c.value)}</div>
    <div class="kpi-label">${esc(c.label)}</div>
  </div>`;
}
