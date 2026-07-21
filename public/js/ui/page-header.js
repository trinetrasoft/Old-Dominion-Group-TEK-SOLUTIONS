export function pageHeader(title, hint = '', extra = '') {
  return `
  <div class="page-head">
    <div>
      <h2>${title}</h2>
      ${hint ? `<div class="hint">${hint}</div>` : ''}
    </div>
    ${extra ? `<div class="page-head-actions">${extra}</div>` : ''}
  </div>`;
}
