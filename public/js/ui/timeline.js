import { icon } from '../icons.js';
import { esc } from '../api.js';

/**
 * items: [{ title, hint, state: 'done'|'current'|'todo' }]
 */
export function timeline(items) {
  return `
  <ul class="timeline" role="list">
    ${items.map(it => `
      <li class="timeline-item ${esc(it.state || 'todo')}">
        <div class="timeline-dot">${icon(
          it.state === 'done' ? 'check' : it.state === 'current' ? 'circle-dot' : 'circle',
          'icon icon-sm'
        )}</div>
        <div class="timeline-content">
          <strong>${esc(it.title)}</strong>
          ${it.hint ? `<span>${esc(it.hint)}</span>` : ''}
        </div>
      </li>`).join('')}
  </ul>`;
}

export function projectGateTimeline(p) {
  const status = p.status;
  const stages = [
    {
      title: 'Initiation',
      hint: 'Project created from won bid',
      state: status === 'initiation' ? 'current' : 'done',
    },
    {
      title: 'CIP enrollment',
      hint: p.cip_enrolled ? 'Recorded' : 'Required before execution',
      state: p.cip_enrolled ? 'done' : (status === 'initiation' ? 'current' : 'todo'),
    },
    {
      title: 'Turnover review',
      hint: p.turnover_reviewed ? 'Recorded' : 'Required before execution',
      state: p.turnover_reviewed ? 'done' : (p.cip_enrolled && status === 'initiation' ? 'current' : (status !== 'initiation' ? 'done' : 'todo')),
    },
    {
      title: 'Execution',
      hint: 'Field work, COs, billing',
      state: status === 'execution' ? 'current' : (['closeout', 'closed'].includes(status) ? 'done' : 'todo'),
    },
    {
      title: 'Closeout',
      hint: status === 'closed' ? 'Project closed' : 'Final billing & handover',
      state: status === 'closed' ? 'done' : (status === 'closeout' ? 'current' : 'todo'),
    },
  ];
  return timeline(stages);
}
