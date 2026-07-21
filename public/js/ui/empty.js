import { icon } from '../icons.js';
import { esc } from '../api.js';

export function emptyState({ title, hint = '', icon: iconName = 'inbox', compact = false } = {}) {
  return `
  <div class="empty-state" ${compact ? 'style="padding:40px 16px"' : ''}>
    <div class="empty-icon">${icon(iconName, 'icon icon-lg')}</div>
    <h4>${esc(title)}</h4>
    ${hint ? `<p>${esc(hint)}</p>` : ''}
  </div>`;
}
