import React, { useEffect, useState } from 'react';

export const PremiumLoader: React.FC<{ label?: string }> = ({ label = 'Loading secure workspace' }) => {
  const [percent, setPercent] = useState(12);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPercent((value) => value >= 88 ? value : Math.min(88, value + Math.ceil((88 - value) / 5)));
    }, 180);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="premium-loader" role="status" aria-live="polite">
      <div className="premium-loader-orbit" aria-hidden="true"><span /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-on-surface">{label}</span>
          <span className="font-mono text-xs font-bold text-primary">{percent}%</span>
        </div>
        <div className="premium-loader-track" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
        <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-on-surface-variant">Encrypted data channel active</span>
      </div>
    </div>
  );
};

interface DeleteConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  itemLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  open, title, description, itemLabel, busy = false, onCancel, onConfirm,
}) => {
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    if (!open) setConfirmation('');
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [busy, onCancel, open]);

  if (!open) return null;
  const ready = confirmation === 'DELETE' && !busy;

  return (
    <div className="premium-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <section className="premium-modal" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="premium-modal-icon"><span className="material-symbols-outlined">delete_forever</span></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="premium-kicker">Permanent action</p>
              <h2 id="delete-dialog-title" className="mt-1 text-xl font-bold text-on-surface">{title}</h2>
            </div>
            <button type="button" className="premium-modal-close" onClick={onCancel} disabled={busy} aria-label="Close delete confirmation">×</button>
          </div>
          <p className="mt-3 text-sm leading-6 text-on-surface-variant">{description}</p>
          {itemLabel ? <p className="mt-2 truncate rounded-lg bg-surface-container px-3 py-2 font-mono text-xs text-on-surface">{itemLabel}</p> : null}
          <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Type DELETE to continue
            <input autoFocus value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} className="premium-confirm-input mt-2" placeholder="DELETE" disabled={busy} spellCheck="false" />
          </label>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="premium-button secondary" onClick={onCancel} disabled={busy}>Keep data</button>
            <button type="button" className="premium-button danger" onClick={onConfirm} disabled={!ready}>
              {busy ? <><span className="premium-spinner" />Deleting…</> : <><span className="material-symbols-outlined text-[18px]">delete</span>Delete permanently</>}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
