import logoAsset from './assets/logo.png'
import { useEffect, useState } from 'react'

export function Icon({ name, size = 20 }) {
  const paths = {
    shield: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3ZM8 12l3 3 5-6',
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    key: 'M15 3a6 6 0 1 1-4 10l-7 7H2v-4l7-7a6 6 0 0 1 6-6ZM16 7h.01',
    user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-3a8 8 0 0 1 16 0v3',
    chat: 'M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4ZM8 10h8M8 14h5',
    logout: 'M9 3H4v18h5M10 12h11M17 8l4 4-4 4',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    'arrow-left': 'M19 12H5M11 6l-6 6 6 6',
    lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v10H5zM12 14v2',
    volume: 'M5 10v4h3l4 4V6l-4 4H5M16 10a3 3 0 0 1 0 4M18 8a6 6 0 0 1 0 8',
    'volume-off': 'M5 10v4h3l4 4V6l-4 4H5M17 9l4 6M21 9l-4 6',
    pulse: 'M2 12h4l3-8 6 16 3-8h4',
    settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
    check: 'M5 12l4 4L19 6',
    copy: 'M9 9h12v12H9zM15 9V3H3v12h6',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3',
    warning: 'M12 3 2.8 20h18.4L12 3ZM12 9v4M12 17h.01',
    paperclip: 'M21.4 11.6 12 21a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5',
    bot: 'M12 8V4M8 4h8M6 9h12v8H6zM9 13h.01M15 13h.01M9 17h6M5 12H3M21 12h-2',
    close: 'M6 6l12 12M18 6 6 18',
    expand: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
    list: 'M5 6h14M5 12h14M5 18h14',
    refresh: 'M20 11a8 8 0 0 0-14-4L4 9M4 5v4h4M4 13a8 8 0 0 0 14 4l2-2M20 19v-4h-4',
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.shield} /></svg>
}

export function PremiumLoader({ label = 'Loading secure workspace' }) {
  const [percent, setPercent] = useState(12)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPercent(value => value >= 88 ? value : Math.min(88, value + Math.ceil((88 - value) / 5)))
    }, 180)
    return () => window.clearInterval(timer)
  }, [])

  return <div className="premium-loader" role="status" aria-live="polite">
    <span className="premium-loader-orbit" aria-hidden="true"><i /></span>
    <span className="premium-loader-copy"><span className="premium-loader-title"><strong>{label}</strong><b>{percent}%</b></span><span className="premium-loader-track"><i style={{ width: `${percent}%` }} /></span><small>Encrypted data channel active</small></span>
  </div>
}

export function DeleteConfirmModal({ open, title, description, itemLabel, busy = false, onCancel, onConfirm }) {
  const [confirmation, setConfirmation] = useState('')

  useEffect(() => {
    if (!open) setConfirmation('')
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const close = event => { if (event.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [busy, onCancel, open])

  if (!open) return null
  const ready = confirmation === 'DELETE' && !busy
  return <div className="delete-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel() }}>
    <section className="delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" onMouseDown={event => event.stopPropagation()}>
      <div className="delete-modal-icon"><Icon name="trash" size={21} /></div>
      <div className="delete-modal-body">
        <div className="delete-modal-head"><div><span className="delete-modal-kicker">Permanent action</span><h2 id="delete-dialog-title">{title}</h2></div><button type="button" className="delete-modal-close" onClick={onCancel} disabled={busy} aria-label="Close delete confirmation">×</button></div>
        <p>{description}</p>
        {itemLabel ? <code>{itemLabel}</code> : null}
        <label className="delete-confirm-label">Type DELETE to continue<input autoFocus value={confirmation} onChange={event => setConfirmation(event.target.value.toUpperCase())} placeholder="DELETE" disabled={busy} spellCheck="false" /></label>
        <div className="delete-modal-actions"><button type="button" className="secondary" onClick={onCancel} disabled={busy}>Keep data</button><button type="button" className="danger" onClick={onConfirm} disabled={!ready}>{busy ? <><span className="premium-spinner" />Deleting...</> : <><Icon name="trash" size={17} />Delete permanently</>}</button></div>
      </div>
    </section>
  </div>
}

export function Brand() {
  return <div className="brand"><span className="brand-mark"><img src={logoAsset} alt="" /></span><span>SENTINEL<span className="lime"> AI</span><small>HOME SECURITY / EDGE INTELLIGENCE</small></span></div>
}
