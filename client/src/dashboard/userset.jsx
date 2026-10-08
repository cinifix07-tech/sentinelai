import { useState } from 'react'
import { apiPost, apiPut } from '../api'
import { DeleteConfirmModal, Icon } from '../ui'

export default function UserSettings({ profile, onSave, preferences, setPreferences, onLogout, notify }) {
  const [editing, setEditing] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function saveActivity(result, reason) {
    apiPost('/access/activity', { result, reason }).catch(() => {})
  }

  async function saveProfile(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const nextProfile = {
      name: values.name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      residence: values.residence.trim(),
    }

    if (!nextProfile.name || !nextProfile.residence) {
      setError('Name and residence cannot be blank.')
      return
    }

    setBusy(true)
    try {
      const saved = await apiPut('/users/me', nextProfile)
      const savedProfile = {
        name: saved.full_name || nextProfile.name,
        email: saved.email || nextProfile.email,
        phone: saved.phone || nextProfile.phone,
        residence: saved.residence || nextProfile.residence,
      }
      const nameChanged = profile.name !== savedProfile.name
      onSave(savedProfile)
      saveActivity(
        nameChanged ? 'NAME_CHANGED' : 'PROFILE_UPDATED',
        nameChanged
          ? `User changed profile name from ${profile.name} to ${savedProfile.name}`
          : `User updated profile details for ${savedProfile.email}`
      )
      setEditing(false)
      setError('')
      notify('Profile saved to the database and activity recorded.')
    } catch (requestError) {
      setError(requestError.message || 'Unable to save profile to the database.')
    } finally {
      setBusy(false)
    }
  }

  async function changePassword(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const currentPassword = String(data.get('current') || '')
    const newPassword = String(data.get('password') || '')
    const confirmation = String(data.get('confirm') || '')
    if (newPassword !== confirmation) {
      setError('New passwords do not match.')
      return
    }

    setBusy(true)
    try {
      await apiPut('/users/me/password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      setChangingPassword(false)
      setError('')
      event.currentTarget.reset()
      notify('Your account password was updated securely.')
    } catch (requestError) {
      setError(requestError.message || 'Could not update your account password.')
    } finally {
      setBusy(false)
    }
  }

  function updateTimeout(timeout) {
    setPreferences({ ...preferences, timeout })
    saveActivity('PREFERENCE_UPDATED', `Session timeout changed to ${timeout} minutes`)
    notify('Session timeout saved.')
  }

  function toggleAlerts() {
    const alerts = !preferences.alerts
    setPreferences({ ...preferences, alerts })
    saveActivity('PREFERENCE_UPDATED', `Security notifications ${alerts ? 'enabled' : 'disabled'}`)
    notify('Notification preference saved. Activity recorded in admin log.')
  }

  function handleLogout() {
    saveActivity('LOGOUT', `User ${profile.email} logged out`)
    onLogout()
  }

  function deleteLocalProfile() {
    setDeleting(true)
    window.setTimeout(() => {
      for (const key of ['profile', 'preferences', 'password']) localStorage.removeItem(`sentinel-client:${key}`)
      setDeleteOpen(false)
      setDeleting(false)
      onLogout()
    }, 650)
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR SPACE / YOUR PREFERENCES</span>
          <h1>Account settings<span className="lime">.</span></h1>
          <p>A personal touch. A little more control.</p>
        </div>
        <span className="pill">LOCAL PROFILE</span>
      </div>

      <div className="settings-grid">
        <section className="card neo profile-card">
          <div className="profile-portrait">
            {profile.name.split(' ').map(part => part[0]).slice(0, 2).join('')}
            <span><Icon name="check" size={16} /></span>
          </div>
          <h2>{profile.name}</h2>
          <p>Primary homeowner</p>
          <span className="pill">RESIDENCE / 402-A</span>
          <div className="profile-details">
            <div><small>Email address</small><strong>{profile.email}</strong></div>
            <div><small>Phone</small><strong>{profile.phone || 'Not added'}</strong></div>
            <div><small>Assigned perimeter</small><strong>{profile.residence}</strong></div>
            <div><small>Account identifier</small><strong>USR-8829-X7K / DEMO</strong></div>
          </div>
          <button className="secondary" onClick={() => { setEditing(!editing); setError('') }} aria-expanded={editing}>
            <Icon name="user" />{editing ? 'Cancel editing' : 'Edit profile'}
          </button>
        </section>

        <div className="settings-main">
          {editing && (
            <section className="card neo">
              <h2>Edit profile</h2>
              <form onSubmit={saveProfile} className="form-stack">
                <div className="field-grid">
                  <label>Full name<input name="name" defaultValue={profile.name} maxLength={70} required autoComplete="name" /></label>
                  <label>Email<input name="email" type="email" defaultValue={profile.email} required autoComplete="email" /></label>
                  <label>Phone<input name="phone" type="tel" defaultValue={profile.phone} autoComplete="tel" /></label>
                  <label>Residence<input name="residence" defaultValue={profile.residence} required maxLength={100} /></label>
                </div>
                {error && <p className="error" role="alert">{error}</p>}
                <button className="primary" disabled={busy}>{busy ? 'Saving...' : 'Save profile'}{!busy && <Icon name="check" />}</button>
              </form>
            </section>
          )}

          <section className="card neo">
            <div className="card-row">
              <h2><Icon name="shield" />Security & access</h2>
              <span className="pill">SECURE ACCOUNT</span>
            </div>
            <p>Keep your account protected with a strong password.</p>
            <div className="setting-row">
              <div>
                <strong>Account password</strong>
                <p>Change the password used to sign in to your Sentinel account.</p>
              </div>
              <button className="secondary" onClick={() => { setChangingPassword(!changingPassword); setError('') }} aria-expanded={changingPassword}>
                {changingPassword ? 'Cancel' : 'Change'}
              </button>
            </div>
            {changingPassword && (
              <form onSubmit={changePassword} className="form-stack password-edit">
                <label>Current password<input name="current" type="password" autoComplete="current-password" required /></label>
                <label>New password<input name="password" type="password" minLength={10} required autoComplete="new-password" /></label>
                <label>Confirm new password<input name="confirm" type="password" minLength={10} required autoComplete="new-password" /></label>
                <small className="muted">Use 10+ characters with uppercase, lowercase, number, and symbol.</small>
                {error && <p role="alert" className="error password-error">{error}</p>}
                <button className="primary" disabled={busy}>{busy ? 'Updating securely...' : 'Update account password'}{!busy && <Icon name="shield" />}</button>
              </form>
            )}
            <div className="setting-row">
              <div>
                <strong>Two-factor authentication</strong>
                <p>Requires a connected authentication provider.</p>
              </div>
              <span className="pill neutral">NOT CONNECTED</span>
            </div>
            <div className="setting-row">
              <div>
                <strong>Inactivity timeout</strong>
                <p>Automatically sign out after inactivity.</p>
              </div>
              <label>
                <span className="sr-only">Inactivity timeout</span>
                <select value={preferences.timeout} onChange={event => updateTimeout(event.target.value)}>
                  {['5', '15', '30', '60'].map(value => <option key={value} value={value}>{value} minutes</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="card neo">
            <h2><Icon name="user" />Current session</h2>
            <div className="setting-row">
              <div>
                <strong>This browser</strong>
                <p>Signed-in account session / No remote sessions connected</p>
              </div>
              <span className="pill">ACTIVE</span>
            </div>
            <div className="session-actions">
              <button className="secondary" onClick={handleLogout}>Revoke local session</button>
              <button className="danger" onClick={handleLogout}><Icon name="logout" />Log out</button>
            </div>
            <div className="danger-zone">
              <div><strong>Delete local profile</strong><p>Permanently remove this browser profile and preferences. Your server account is not changed.</p></div>
              <button className="danger" onClick={() => setDeleteOpen(true)}><Icon name="trash" />Delete profile</button>
            </div>
          </section>
        </div>
      </div>

      <DeleteConfirmModal open={deleteOpen} title="Delete your local profile?" description="This permanently clears the profile, preferences, and local demo credentials stored in this browser. Your server account is not changed." itemLabel={profile.email} busy={deleting} onCancel={() => { if (!deleting) setDeleteOpen(false) }} onConfirm={deleteLocalProfile} />
    </>
  )
}
