// אייקוני גופן (Font Awesome Free, מצורף לפרויקט ואינו נטען מרשת חיצונית).
export default function Icon({ name, className = '' }) {
  return <i className={`fa-solid fa-${name}${className ? ` ${className}` : ''}`} aria-hidden="true" />;
}

export const NAV_ICONS = {
  dashboard: 'gauge-high',
  projects: 'folder-open',
  tasks: 'list-check',
  meetings: 'microphone-lines',
  assistant: 'wand-magic-sparkles',
  risks: 'triangle-exclamation',
  decisions: 'gavel',
  changes: 'right-left',
  payments: 'shekel-sign',
  backup: 'cloud-arrow-down',
  more: 'ellipsis',
};
