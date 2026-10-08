import React, { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../api.js';
import { DeleteConfirmModal, PremiumLoader } from '../PremiumUI';

interface UserRow {
  user_id?: number | string;
  id?: number | string;
  full_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  is_active?: boolean;
  created_at?: string;
}

type UserSegment = 'all' | 'ADMIN' | 'USER';

interface VisitorsScreenProps {
  onOpenQuickPassForm?: () => void;
}

const PAGE_SIZE_OPTIONS = [5, 10, 15];

function displayName(user: UserRow) {
  return user.full_name || user.name || user.email || 'Unnamed user';
}

function initialsFor(user: UserRow) {
  return displayName(user)
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatDate(value?: string) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function passwordStrength(value: string) {
  const checks = [value.length >= 10, /[A-Z]/.test(value), /[a-z]/.test(value), /\d/.test(value), /[^A-Za-z\d]/.test(value)];
  const score = checks.filter(Boolean).length;
  return {
    score,
    percent: Math.max(4, score * 20),
    label: !value ? 'Use a unique password for this account' : score < 3 ? 'Weak password' : score < 5 ? 'Almost there' : 'Strong password',
  };
}

export const VisitorsScreen: React.FC<VisitorsScreenProps> = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [activeSegment, setActiveSegment] = useState<UserSegment>('all');
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerBusy, setRegisterBusy] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [actionUserId, setActionUserId] = useState<string | number | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<UserRow | null>(null);
  const [changePasswordValue, setChangePasswordValue] = useState('');
  const [changePasswordBusy, setChangePasswordBusy] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState('');

  async function loadUsers() {
    setLoading(true);
    setError('');
    try {
      setUsers(await apiGet('/users'));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [activeSegment, query, pageSize]);

  async function deleteUser() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/users/${deleteTarget.user_id || deleteTarget.id}`);
      setUsers((current) => current.filter((user) => (user.user_id || user.id) !== (deleteTarget.user_id || deleteTarget.id)));
      setDeleteTarget(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete user.');
    } finally {
      setDeleting(false);
    }
  }

  async function registerUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRegisterBusy(true);
    setRegisterError('');
    try {
      const form = new FormData(event.currentTarget);
      await apiPost('/users', {
        first_name: String(form.get('first_name') || ''),
        last_name: String(form.get('last_name') || ''),
        phone: String(form.get('phone') || ''),
        username: String(form.get('username') || ''),
        password: String(form.get('password') || ''),
        role: String(form.get('role') || 'USER'),
      });
      setRegisterOpen(false);
      setPasswordValue('');
      await loadUsers();
    } catch (requestError) {
      setRegisterError(requestError instanceof Error ? requestError.message : 'Unable to register user.');
    } finally {
      setRegisterBusy(false);
    }
  }

  async function changeUserPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordTarget) return;
    setChangePasswordBusy(true);
    setChangePasswordError('');
    try {
      await apiPut(`/users/${passwordTarget.user_id || passwordTarget.id}/password`, { password: changePasswordValue });
      setPasswordTarget(null);
      setChangePasswordValue('');
    } catch (requestError) {
      setChangePasswordError(requestError instanceof Error ? requestError.message : 'Unable to change password.');
    } finally {
      setChangePasswordBusy(false);
    }
  }

  const counts = useMemo(() => {
    return users.reduce(
      (total, user) => {
        const role = user.role === 'ADMIN' ? 'ADMIN' : 'USER';
        total.all += 1;
        total[role] += 1;
        return total;
      },
      { all: 0, ADMIN: 0, USER: 0 }
    );
  }, [users]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users.filter((user) => {
      const role = user.role === 'ADMIN' ? 'ADMIN' : 'USER';
      if (activeSegment !== 'all' && role !== activeSegment) return false;
      if (!normalizedQuery) return true;
      return [displayName(user), user.email, user.phone, role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [activeSegment, query, users]);

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const visibleStart = filteredUsers.length ? (currentPage - 1) * pageSize + 1 : 0;
  const visibleEnd = Math.min(currentPage * pageSize, filteredUsers.length);

  const segments: { id: UserSegment; label: string; icon: string }[] = [
    { id: 'all', label: 'All users', icon: 'groups' },
    { id: 'ADMIN', label: 'Admins', icon: 'admin_panel_settings' },
    { id: 'USER', label: 'Clients', icon: 'person' },
  ];

  return (
    <div className="flex flex-col w-full gap-5 max-w-7xl mx-auto pb-24">
      <section className="flex flex-col w-full bg-surface-container-lowest rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-[11px] font-semibold text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Users table live
              </span>
            </div>
            <h1 className="font-display font-bold text-xl sm:text-2xl text-on-surface tracking-tight">
              User Management
            </h1>
            <p className="text-[12px] text-on-surface-variant mt-0.5">
              Review database accounts, separate administrators from client users, and audit access at a glance.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 min-w-0 lg:min-w-[360px]">
            <div className="rounded-xl bg-surface-container p-3">
              <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Total</span>
              <strong className="block text-xl font-display text-on-surface mt-1">{counts.all}</strong>
            </div>
            <div className="rounded-xl bg-primary-fixed/70 p-3">
              <span className="text-[10px] text-on-primary-fixed-variant font-semibold uppercase tracking-wide">Admins</span>
              <strong className="block text-xl font-display text-on-primary-fixed mt-1">{counts.ADMIN}</strong>
            </div>
            <div className="rounded-xl bg-secondary-fixed/80 p-3">
              <span className="text-[10px] text-on-secondary-fixed font-semibold uppercase tracking-wide">Clients</span>
              <strong className="block text-xl font-display text-on-secondary-fixed mt-1">{counts.USER}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container/60 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-surface-container flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="flex p-1.5 bg-surface-container rounded-xl shadow-xs gap-1">
              {segments.map((segment) => (
                <button
                  key={segment.id}
                  type="button"
                  onClick={() => setActiveSegment(segment.id)}
                  className={`min-h-10 px-3 sm:px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 ${
                    activeSegment === segment.id
                      ? 'text-white bg-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px]">{segment.icon}</span>
                  <span>{segment.label}</span>
                  <span className="font-mono opacity-80">
                    {segment.id === 'all' ? counts.all : counts[segment.id]}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <label className="relative min-w-[240px]">
                <span className="sr-only">Search users</span>
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
                  search
                </span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-10 w-full rounded-xl bg-surface-container pl-10 pr-3 text-xs text-on-surface outline-none border border-transparent focus:border-primary"
                  placeholder="Search name, email, phone..."
                />
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setRegisterError(''); setRegisterOpen(true); }} className="h-10 px-4 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors flex items-center justify-center gap-1.5 shadow-xs">
                  <span className="material-symbols-outlined text-[17px]">person_add</span>
                  Register user
                </button>
                <button type="button" onClick={loadUsers} className="h-10 px-4 rounded-xl bg-surface-container text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px]">sync</span>
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left">
            <thead className="bg-surface-container-low text-[11px] uppercase tracking-wide text-on-surface-variant">
              <tr>
                <th className="px-5 py-3 font-semibold">User</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Contact</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Created</th>
                <th className="px-5 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {loading && (
                <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-on-surface-variant">
                    <PremiumLoader label="Loading users from database" />
                  </td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-[#ba1a1a]">
                    {error}
                  </td>
                </tr>
              )}

              {!loading && !error && pagedUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-on-surface-variant">
                    No users match this view.
                  </td>
                </tr>
              )}

              {!loading && !error && pagedUsers.map((user) => {
                const role = user.role === 'ADMIN' ? 'ADMIN' : 'USER';
                return (
                  <tr key={user.user_id || user.id || user.email} className="hover:bg-surface-container-low/70 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-10 h-10 rounded-full grid place-items-center text-xs font-bold shadow-xs shrink-0 ${
                          role === 'ADMIN'
                            ? 'bg-primary text-on-primary'
                            : 'bg-secondary-fixed text-on-secondary-fixed'
                        }`}>
                          {initialsFor(user)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-display font-semibold text-sm text-on-surface truncate">{displayName(user)}</p>
                          <p className="font-mono text-[11px] text-on-surface-variant">
                            ID {user.user_id || user.id || 'pending'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        role === 'ADMIN'
                          ? 'bg-primary-fixed text-on-primary-fixed-variant'
                          : 'bg-surface-container text-on-surface-variant'
                      }`}>
                        <span className="material-symbols-outlined text-[14px]">
                          {role === 'ADMIN' ? 'admin_panel_settings' : 'person'}
                        </span>
                        {role === 'ADMIN' ? 'Admin' : 'Client user'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-0.5 text-xs">
                        <span className="text-on-surface">{user.email || 'No email'}</span>
                        <span className="text-on-surface-variant">{user.phone || 'No phone'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        user.is_active === false
                          ? 'bg-error-container text-on-error-container'
                          : 'bg-primary-fixed/70 text-on-primary-fixed-variant'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {user.is_active === false ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-on-surface-variant">{formatDate(user.created_at)}</td>
                    <td className="relative px-5 py-4 text-right">
                      <button type="button" onClick={() => setActionUserId((current) => current === (user.user_id || user.id) ? null : (user.user_id || user.id || null))} className="inline-grid h-9 w-9 place-items-center rounded-lg bg-surface-container text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface" aria-label={`Actions for ${displayName(user)}`} aria-expanded={actionUserId === (user.user_id || user.id)}>
                        <span className="material-symbols-outlined text-[20px]">more_vert</span>
                      </button>
                      {actionUserId === (user.user_id || user.id) && <div className="absolute right-5 top-14 z-20 w-48 rounded-xl border border-surface-container bg-surface-container-lowest p-1.5 text-left shadow-lg">
                        <button type="button" onClick={() => { setDeleteTarget(user); setActionUserId(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-on-error-container transition hover:bg-error-container/60">
                          <span className="material-symbols-outlined text-[17px]">delete</span>Delete user
                        </button>
                        {role === 'ADMIN' && <button type="button" onClick={() => { setPasswordTarget(user); setChangePasswordValue(''); setChangePasswordError(''); setActionUserId(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-on-surface transition hover:bg-surface-container">
                          <span className="material-symbols-outlined text-[17px]">key</span>Change password
                        </button>}
                      </div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 sm:p-5 border-t border-surface-container flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <p className="text-xs text-on-surface-variant">
            Showing <span className="font-semibold text-on-surface">{visibleStart}</span>-<span className="font-semibold text-on-surface">{visibleEnd}</span> of <span className="font-semibold text-on-surface">{filteredUsers.length}</span> users
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-on-surface-variant">
              Rows
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="h-9 rounded-lg bg-surface-container px-2 text-xs text-on-surface outline-none"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage === 1}
              className="h-9 px-3 rounded-lg bg-surface-container text-xs font-semibold text-on-surface disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-container-high"
            >
              Previous
            </button>
            <span className="h-9 px-3 rounded-lg bg-primary text-on-primary text-xs font-semibold grid place-items-center">
              {currentPage} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              disabled={currentPage === pageCount}
              className="h-9 px-3 rounded-lg bg-surface-container text-xs font-semibold text-on-surface disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-container-high"
            >
              Next
            </button>
          </div>
        </div>
      </section>
      <DeleteConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete this account?"
        description="This permanently removes the user record and cannot be undone. Confirm the exact action before the database is changed."
        itemLabel={deleteTarget ? `${displayName(deleteTarget)} · ${deleteTarget.email || 'No email'}` : undefined}
        busy={deleting}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
        onConfirm={deleteUser}
      />
      {passwordTarget ? <div className="register-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !changePasswordBusy) setPasswordTarget(null); }}>
        <section className="register-modal" role="dialog" aria-modal="true" aria-labelledby="change-password-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="register-modal-header">
            <div className="register-modal-mark"><span className="material-symbols-outlined">key</span></div>
            <div className="min-w-0"><p className="premium-kicker">Administrator action</p><h2 id="change-password-title">Change password</h2><p>Set a new password for {displayName(passwordTarget)}.</p></div>
            <button type="button" className="register-modal-close" onClick={() => setPasswordTarget(null)} disabled={changePasswordBusy} aria-label="Close change password form">×</button>
          </div>
          <form className="register-form" onSubmit={changeUserPassword}>
            <label className="register-password-field">New password<input type="password" required minLength={10} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,}" value={changePasswordValue} onChange={(event) => setChangePasswordValue(event.target.value)} placeholder="Create a strong password" autoFocus /></label>
            {changePasswordError ? <p className="register-error" role="alert">{changePasswordError}</p> : null}
            <div className="register-actions"><button type="button" className="premium-button secondary" onClick={() => setPasswordTarget(null)} disabled={changePasswordBusy}>Cancel</button><button type="submit" className="premium-button primary" disabled={changePasswordBusy}>{changePasswordBusy ? 'Updating...' : 'Update password'}</button></div>
          </form>
        </section>
      </div> : null}
      {registerOpen ? (
        <div className="register-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !registerBusy) setRegisterOpen(false); }}>
          <section className="register-modal" role="dialog" aria-modal="true" aria-labelledby="register-user-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="register-modal-header">
              <div className="register-modal-mark"><span className="material-symbols-outlined">person_add</span></div>
              <div className="min-w-0"><p className="premium-kicker">Secure account enrollment</p><h2 id="register-user-title">Register user account</h2><p>Create a database account with identity and access details.</p></div>
              <button type="button" className="register-modal-close" onClick={() => setRegisterOpen(false)} disabled={registerBusy} aria-label="Close registration form">×</button>
            </div>
            <form className="register-form" onSubmit={registerUser}>
              <div className="register-form-grid">
                <label>First name<input name="first_name" required placeholder="Sarah" /></label>
                <label>Last name<input name="last_name" required placeholder="Chen" /></label>
                <label>Phone number<input name="phone" type="tel" inputMode="numeric" pattern="[0-9]+" maxLength={20} placeholder="639000000000" onChange={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/\D/g, ''); }} /></label>
                <label>Username<input name="username" required placeholder="sarah.chen@cinifix.com" /></label>
                <label className="register-password-field">Password<input name="password" type="password" minLength={10} required pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,}" value={passwordValue} onChange={(event) => setPasswordValue(event.target.value)} placeholder="Create a strong password" />
                  <span className="password-strength" data-score={passwordStrength(passwordValue).score}><i style={{ width: `${passwordStrength(passwordValue).percent}%` }} /></span>
                  <small className="password-strength-label">{passwordStrength(passwordValue).label}</small>
                  <span className="password-requirements"><b className={passwordValue.length >= 10 ? 'met' : ''}>10+ characters</b><b className={/[A-Z]/.test(passwordValue) ? 'met' : ''}>Uppercase</b><b className={/[a-z]/.test(passwordValue) ? 'met' : ''}>Lowercase</b><b className={/\d/.test(passwordValue) ? 'met' : ''}>Number</b><b className={/[^A-Za-z\d]/.test(passwordValue) ? 'met' : ''}>Symbol</b></span>
                </label>
                <label>Role<select name="role" defaultValue="USER"><option value="USER">Client user</option><option value="ADMIN">Administrator</option></select></label>
              </div>
              {false && <div className="register-audio-grid">
                <label className="register-audio-field"><span>1. Background noise sample</span><small>Upload room noise for voice calibration.</small><input name="noise_audio" type="file" accept="audio/*" required onChange={(event) => setAudioNames((value) => ({ ...value, noise: event.target.files?.[0]?.name || '' }))} /><em>{audioNames.noise || 'Choose an audio file'}</em></label>
                <label className="register-audio-field"><span>2. Voice introduction sample</span><small>Say: “My name is…, my birthday is…, my room is…”</small><input name="voice_audio" type="file" accept="audio/*" required onChange={(event) => setAudioNames((value) => ({ ...value, voice: event.target.files?.[0]?.name || '' }))} /><em>{audioNames.voice || 'Choose an audio file'}</em></label>
              </div>}
              {registerError ? <p className="register-error" role="alert">{registerError}</p> : null}
              <div className="register-actions"><button type="button" className="premium-button secondary" onClick={() => setRegisterOpen(false)} disabled={registerBusy}>Cancel</button><button type="submit" className="premium-button primary" disabled={registerBusy}>{registerBusy ? <><span className="premium-spinner" />Saving account...</> : <><span className="material-symbols-outlined text-[18px]">save</span>Save user account</>}</button></div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
};
