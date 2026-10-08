const iconLabels = { activity: '◌', bell: '●', box: '□', check: '✓', home: '⌂', lock: '▣', mic: '◉', radar: '◌', settings: '⚙', shield: '⬟', unlock: '□', users: '♙', wifi: '⌁', x: '×' }

export function Icon({ name = 'check', size = 16 }) {
  return <span aria-hidden="true" style={{ fontSize: size, lineHeight: 1 }}>{iconLabels[name] || iconLabels.check}</span>
}

export function Button({ children, variant = 'secondary', icon, onClick, type = 'button' }) {
  return <button type={type} className={`button button-${variant}`} onClick={onClick}>{icon && <Icon name={icon} size={15} />}{children}</button>
}

export function Badge({ children, tone = 'neutral', icon }) {
  return <span className={`badge badge-${tone}`}>{icon && <Icon name={icon} size={12} />}{children}</span>
}

export function Dialog({ title, onClose, children }) {
  return <div className="dialog-backdrop" role="presentation" onClick={onClose}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={(event) => event.stopPropagation()}><div className="panel-head"><h2 id="dialog-title">{title}</h2><button type="button" aria-label="Close dialog" onClick={onClose}><Icon name="x" /></button></div>{children}</section></div>
}

export function Timeline({ events = [] }) {
  return <ol className="timeline">{events.map((event) => <li key={event.id}><span className={`timeline-dot ${event.tone || ''}`}><Icon name={event.icon} size={13} /></span><div><strong>{event.title}</strong><p>{event.detail}</p></div><time>{event.time}</time></li>)}</ol>
}