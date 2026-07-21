import { icon } from '../icons.js';
import { esc } from '../api.js';

export function errorPage(message) {
  return `
  <div class="panel">
    <div class="error-page">
      <div class="error-icon">${icon('alert-circle', 'icon icon-xl')}</div>
      <h2>Something went wrong</h2>
      <p>${esc(message || 'An unexpected error occurred while loading this page.')}</p>
      <button class="btn primary" id="error-retry">${icon('refresh-cw', 'icon icon-sm')} Try again</button>
    </div>
  </div>`;
}

export function bindErrorRetry() {
  document.getElementById('error-retry')?.addEventListener('click', () => window.render?.());
}
