import React, { useCallback, useEffect, useState } from 'react';
import { AppTab } from '../../types';
import { apiDelete, apiGet, apiPost, apiPut } from '../../api.js';

interface DevicesScreenProps { onNavigate: (tab: AppTab) => void; }
interface Device { device_id?: string; device_code?: string; device_name?: string; location?: string; device_type?: string; is_online?: boolean; last_seen?: string; }

export const DevicesScreen: React.FC<DevicesScreenProps> = ({ onNavigate }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [editForm, setEditForm] = useState({ device_name: '', location: '', status: 'offline' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ device_code: '', device_name: '', location: '', device_type: 'ESP32 PIR' });

  const loadDevices = useCallback(async () => {
    setLoading(true); setError('');
    try { const response = await apiGet('/devices'); setDevices(Array.isArray(response) ? response : []); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to load devices.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDevices(); const timer = window.setInterval(loadDevices, 10000); return () => window.clearInterval(timer); }, [loadDevices]);

  const onlineDevices = devices.filter(isOnline);
  const offlineDevices = devices.filter((device) => !isOnline(device));

  const addDevice = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.device_code.trim() || !form.device_name.trim()) { setError('Device code and device name are required.'); return; }
    setSaving(true); setError('');
    try {
      await apiPost('/devices', { device_code: form.device_code.trim(), device_name: form.device_name.trim(), location: form.location.trim() || 'Main residence', device_type: form.device_type });
      setForm({ device_code: '', device_name: '', location: '', device_type: 'ESP32 PIR' }); setShowAddForm(false); setNotice('Device added successfully.'); await loadDevices();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to add device.'); }
    finally { setSaving(false); }
  };

  const openEdit = (device: Device) => {
    setError('');
    setEditForm({ device_name: device.device_name || '', location: device.location || '', status: isOnline(device) ? 'functional' : 'offline' });
    setEditingDevice(device);
  };

  const saveEdit = async () => {
    if (!editingDevice) return;
    const id = String(editingDevice.device_id || '');
    const name = editForm.device_name.trim();
    const location = editForm.location.trim();
    if (!name || !location) { setError('Device name and location are required.'); return; }
    const isOnline = editForm.status === 'functional';
    setEditSaving(true); setError('');
    try {
      const updated = await apiPut(`/devices/${encodeURIComponent(id)}`, { device_name: name, location, is_online: isOnline, last_seen: isOnline ? new Date().toISOString() : null });
      setDevices((current) => current.map((item) => String(item.device_id) === id ? { ...item, ...(updated?.device || updated || { device_name: name, location, is_online: isOnline }) } : item));
      setEditingDevice(null); setNotice('Device details updated.');
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to update device.'); }
    finally { setEditSaving(false); }
  };

  const removeDevice = (device: Device) => {
    setError('');
    setDeleteConfirmation('');
    setDeleteTarget(device);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleteConfirmation.trim() !== (deleteTarget.device_name || '')) return;
    const device = deleteTarget;
    const id = String(device.device_id || '');
    if (!id) return;
    setDeleting(id); setError('');
    try { await apiDelete(`/devices/${encodeURIComponent(id)}`); setDevices((current) => current.filter((item) => String(item.device_id) !== id)); setDeleteTarget(null); setNotice('Device deleted.'); await loadDevices(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to delete device.'); }
    finally { setDeleting(''); }
  };

  return <div className="flex flex-col w-full gap-5 max-w-7xl mx-auto pb-24">
    <section className="device-center-hero"><div className="flex items-start gap-3 min-w-0"><div className="device-center-icon"><span className="material-symbols-outlined">devices</span></div><div className="min-w-0"><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Device center</span><h1 className="font-display text-2xl sm:text-3xl font-semibold text-on-surface mt-1">Connected devices</h1><p className="text-xs text-on-surface-variant mt-1">Manage every Sentinel node connected to your residence.</p></div></div><div className="device-center-stats"><span><strong>{onlineDevices.length}</strong> online</span><span><strong>{offlineDevices.length}</strong> offline</span><button type="button" onClick={loadDevices} disabled={loading}><span className="material-symbols-outlined">refresh</span>{loading ? 'Syncing' : 'Refresh'}</button></div></section>
    {error && <div className="device-page-error" role="alert">{error}</div>}{notice && <div className="device-page-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div>}
    <section className="device-section-heading"><div><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Your hardware</span><h2 className="font-display text-lg font-semibold text-on-surface mt-1">Device inventory</h2></div><span className="text-[11px] text-on-surface-variant">{devices.length} registered device{devices.length === 1 ? '' : 's'}</span></section>
    <section className="device-grid">{devices.map((device) => <DeviceCard key={device.device_id || device.device_code} device={device} deleting={deleting === String(device.device_id)} onEdit={() => openEdit(device)} onDelete={() => removeDevice(device)} onOpen={() => onNavigate('monitor')} />)}<button type="button" className="add-device-card" onClick={() => setShowAddForm(true)}><span className="add-device-icon"><span className="material-symbols-outlined">add</span></span><strong>Add device</strong><small>Register a new ESP32 or sensor node</small></button></section>
    {showAddForm && <div className="device-modal-backdrop" role="presentation"><form className="device-modal" onSubmit={addDevice}><div className="device-modal-head"><div><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">New hardware</span><h2 className="font-display text-xl font-semibold text-on-surface mt-1">Add device</h2></div><button type="button" className="device-modal-close" onClick={() => setShowAddForm(false)} aria-label="Close add device"><span className="material-symbols-outlined">close</span></button></div><div className="device-form-grid"><label>Device code<input value={form.device_code} onChange={(event) => setForm({ ...form, device_code: event.target.value })} placeholder="esp32-porch-02" /></label><label>Device name<input value={form.device_name} onChange={(event) => setForm({ ...form, device_name: event.target.value })} placeholder="Garage sensor node" /></label><label>Location<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Garage entrance" /></label><label>Device type<select value={form.device_type} onChange={(event) => setForm({ ...form, device_type: event.target.value })}><option>ESP32 PIR</option><option>ESP32 Camera</option><option>HC-SR501 Sensor</option></select></label></div><div className="device-modal-actions"><button type="button" className="device-secondary-button" onClick={() => setShowAddForm(false)}>Cancel</button><button type="submit" className="device-primary-button" disabled={saving}><span className="material-symbols-outlined">add_circle</span>{saving ? 'Adding...' : 'Add device'}</button></div></form></div>}
    {editingDevice && <EditDeviceModal form={editForm} setForm={setEditForm} saving={editSaving} onClose={() => setEditingDevice(null)} onSave={saveEdit} />}
    {deleteTarget && <DeleteDeviceModal device={deleteTarget} confirmation={deleteConfirmation} deleting={deleting === String(deleteTarget.device_id)} onChange={setDeleteConfirmation} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} />}
  </div>;
};

function DeviceCard({ device, deleting, onEdit, onDelete, onOpen }: { device: Device; deleting: boolean; onEdit: () => void; onDelete: () => void; onOpen: () => void }) {
  const online = isOnline(device);
  return <article className={`device-card ${online ? 'device-card-online' : 'device-card-offline'}`}><div className="device-card-top"><div className={`device-card-icon ${online ? '' : 'offline'}`}><span className="material-symbols-outlined">{online ? 'sensors' : 'sensors_off'}</span></div><div className="device-card-title"><h3>{device.device_name || device.device_code || 'Unnamed device'}</h3><p>{device.device_code || 'No device code'}</p></div><div className="device-card-actions"><button type="button" className="device-edit-button" onClick={onEdit} aria-label={`Edit ${device.device_name || 'device'}`} title="Edit device"><span className="material-symbols-outlined">edit</span></button><button type="button" className="device-delete-button" onClick={onDelete} disabled={deleting} aria-label={`Delete ${device.device_name || 'device'}`} title="Delete device"><span className="material-symbols-outlined">delete</span></button></div></div><div className="device-status-line"><span className={`device-status-pill ${online ? 'online' : 'offline'}`}><i />{online ? 'FUNCTIONAL' : 'NOT FUNCTIONAL'}</span></div><div className="device-card-details"><div><small>LOCATION</small><strong>{device.location || 'Main residence'}</strong></div><div><small>TYPE</small><strong>{device.device_type || 'Sensor node'}</strong></div><div><small>LAST SEEN</small><strong>{online ? formatLastSeen(device.last_seen) : 'Unavailable'}</strong></div></div><button type="button" className="device-open-button" onClick={onOpen}><span>Open device monitor</span><span className="material-symbols-outlined">arrow_forward</span></button></article>;
}

function EditDeviceModal({ form, setForm, saving, onClose, onSave }: { form: { device_name: string; location: string; status: string }; setForm: React.Dispatch<React.SetStateAction<{ device_name: string; location: string; status: string }>>; saving: boolean; onClose: () => void; onSave: () => void }) {
  return <div className="device-modal-backdrop" role="presentation"><form className="device-modal" onSubmit={(event) => { event.preventDefault(); onSave(); }}><div className="device-modal-head"><div><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Device settings</span><h2 className="font-display text-xl font-semibold text-on-surface mt-1">Edit device</h2><p className="device-modal-subtitle">Update the identity and live state shown in the inventory.</p></div><button type="button" className="device-modal-close" onClick={onClose} aria-label="Close edit device"><span className="material-symbols-outlined">close</span></button></div><div className="device-form-grid"><label>Device name<input value={form.device_name} onChange={(event) => setForm({ ...form, device_name: event.target.value })} autoFocus /></label><label>Location<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label><label className="device-form-full">Device status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="functional">Functional</option><option value="offline">Not functional</option></select></label></div><div className="device-modal-actions"><button type="button" className="device-secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="device-primary-button" disabled={saving}><span className="material-symbols-outlined">save</span>{saving ? 'Saving...' : 'Save changes'}</button></div></form></div>;
}

function DeleteDeviceModal({ device, confirmation, deleting, onChange, onClose, onConfirm }: { device: Device; confirmation: string; deleting: boolean; onChange: (value: string) => void; onClose: () => void; onConfirm: () => void }) {
  const matches = confirmation.trim() === (device.device_name || '');
  return <div className="device-modal-backdrop" role="presentation"><div className="device-modal device-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-device-title"><div className="device-danger-icon"><span className="material-symbols-outlined">delete_forever</span></div><div className="device-modal-head"><div><span className="device-danger-kicker">Permanent action</span><h2 id="delete-device-title" className="font-display text-xl font-semibold text-on-surface mt-1">Delete device?</h2></div><button type="button" className="device-modal-close" onClick={onClose} aria-label="Close delete confirmation"><span className="material-symbols-outlined">close</span></button></div><p className="device-modal-copy">This removes <strong>{device.device_name || 'this device'}</strong> from your hardware inventory. Type the device name below to confirm.</p><label className="device-confirm-label">Type device name<input value={confirmation} onChange={(event) => onChange(event.target.value)} placeholder={device.device_name || 'Device name'} autoFocus /></label><div className="device-modal-actions"><button type="button" className="device-secondary-button" onClick={onClose}>Keep device</button><button type="button" className="device-danger-button" disabled={!matches || deleting} onClick={onConfirm}><span className="material-symbols-outlined">delete</span>{deleting ? 'Deleting...' : 'Delete device'}</button></div></div></div>;
}

function isOnline(device: Device) { if (!device.is_online) return false; if (!device.last_seen) return true; const timestamp = new Date(device.last_seen).getTime(); return Number.isNaN(timestamp) || Date.now() - timestamp < 60000; }
function formatLastSeen(value?: string) { if (!value) return 'Just now'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Just now' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
