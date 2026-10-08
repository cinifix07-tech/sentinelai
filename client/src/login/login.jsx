import { useEffect, useRef, useState } from 'react'
import logoAsset from '../assets/logo.png'
import { apiGet, apiPost, loginToBackend, roleHome } from '../api'
import { startBackendSession } from '../storage'
import { Brand, Icon } from '../ui'

export default function Login({ onAuthenticated }) {
  const [visible, setVisible] = useState(false)
  const [loginTheme, setLoginTheme] = useState('daylight')
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showVisitorChat, setShowVisitorChat] = useState(false)
  const [visitorForm, setVisitorForm] = useState({ name: '', purpose: '' })
  const [visitorBusy, setVisitorBusy] = useState(false)
  const [visitorStatus, setVisitorStatus] = useState('')
  const [visitorError, setVisitorError] = useState('')
  const [visitorSession, setVisitorSession] = useState(null)
  const [visitorMessages, setVisitorMessages] = useState([])
  const [visitorDraft, setVisitorDraft] = useState('')
  const [visitorAttachment, setVisitorAttachment] = useState(null)
  const [visitorMessageBusy, setVisitorMessageBusy] = useState(false)
  const visitorEndRef = useRef(null)
  const themes = [
    { id: 'daylight', label: 'Daylight Calm', swatch: '#f8f9ff' },
    { id: 'twilight', label: 'Twilight Slate', swatch: '#283541' },
    { id: 'midnight', label: 'Midnight Patrol', swatch: '#1c252e' },
    { id: 'sage', label: 'Sage Garden', swatch: '#e6eee7' },
  ]

  async function submit(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setBusy(true)
    setError('')

    try {
      const session = await loginToBackend(data.get('identity').trim(), data.get('password'))
      if (session.role !== 'USER') {
        const adminUrl = roleHome(session.role)
        if (adminUrl) {
          window.location.assign(adminUrl)
          return
        }
        setError('This account is for the admin portal. Please sign in through the admin app.')
        return
      }

      startBackendSession(session, Boolean(data.get('remember')))
      onAuthenticated(session)
    } catch (error) {
      setError(error.message || 'Unable to sign in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function submitVisitorIntake(event) {
    event.preventDefault()
    setVisitorBusy(true)
    setVisitorStatus('')
    setVisitorError('')
    try {
      const created = await apiPost('/communicate/visitor-intake', visitorForm)
      setVisitorSession(created)
      setVisitorMessages([created])
      setVisitorForm({ name: '', purpose: '' })
    } catch (error) {
      setVisitorError(error.message || 'Unable to contact the administrator.')
    } finally {
      setVisitorBusy(false)
    }
  }

  useEffect(() => {
    if (!visitorSession?.visitor_id) return undefined
    const loadVisitorMessages = () => apiGet(`/communicate/visitor-messages/${encodeURIComponent(visitorSession.visitor_id)}`)
      .then(setVisitorMessages)
      .catch(() => undefined)
    loadVisitorMessages()
    const timer = window.setInterval(loadVisitorMessages, 4000)
    return () => window.clearInterval(timer)
  }, [visitorSession])

  useEffect(() => {
    visitorEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [visitorMessages.length, visitorSession])

  async function sendVisitorMessage(event) {
    event.preventDefault()
    const message = visitorDraft.trim()
    if ((!message && !visitorAttachment) || !visitorSession?.visitor_id) return
    setVisitorMessageBusy(true)
    setVisitorError('')
    try {
      const created = await apiPost('/communicate/visitor-messages', {
        visitor_id: visitorSession.visitor_id,
        message,
        attachment_data: visitorAttachment?.data || '',
        attachment_name: visitorAttachment?.name || '',
        attachment_type: visitorAttachment?.type || '',
        attachment_size: visitorAttachment?.size || 0,
      })
      setVisitorMessages((current) => [...current, created])
      setVisitorDraft('')
      setVisitorAttachment(null)
    } catch (error) {
      setVisitorError(error.message || 'Unable to send your message.')
    } finally {
      setVisitorMessageBusy(false)
    }
  }

  function handleVisitorAttachment(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      setVisitorError('Attachments must be 8 MB or smaller.')
      return
    }
    const supported = /^(image|video|audio)\//.test(file.type) || ['application/pdf', 'text/plain', 'application/zip', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(file.type)
    if (!supported) {
      setVisitorError('This file type is not supported.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setVisitorAttachment({ data: String(reader.result || ''), name: file.name, type: file.type || 'application/octet-stream', size: file.size })
      setVisitorError('')
    }
    reader.onerror = () => setVisitorError('Unable to read that file.')
    reader.readAsDataURL(file)
  }

  function renderVisitorAttachment(item) {
    if (!item.attachment_data) return null
    if (item.attachment_type?.startsWith('image/')) return <img className="visitor-chat-attachment-image" src={item.attachment_data} alt={item.attachment_name || 'Attached image'} />
    if (item.attachment_type?.startsWith('video/')) return <video className="visitor-chat-attachment-media" src={item.attachment_data} controls preload="metadata" />
    if (item.attachment_type?.startsWith('audio/')) return <audio className="visitor-chat-attachment-audio" src={item.attachment_data} controls />
    return <a className="visitor-chat-attachment-file" href={item.attachment_data} download={item.attachment_name || 'attachment'}>{item.attachment_name || 'Download attachment'}</a>
  }

  return <div className={`login-page premium-login theme-${loginTheme}`}>
    <header className="login-header premium-login-header">
      <div className="login-header-brand premium-brand">
        <span className="premium-brand-mark"><img src={logoAsset} alt="Sentinel AI" /></span>
        <span className="premium-brand-copy">
          <strong>SENTINEL AI</strong>
          <small>HOME SECURITY / EDGE INTELLIGENCE</small>
        </span>
      </div>
      <div className="login-header-actions">
        <div className="theme-picker">
          <button type="button" className="theme-picker-button" aria-label="Change login color theme" onClick={() => setShowThemeMenu((visible) => !visible)}>
            <span className="theme-orb" aria-hidden="true" />
          </button>
          {showThemeMenu && <div className="theme-menu">
            <strong>Login atmosphere</strong>
            {themes.map((theme) => <button key={theme.id} type="button" className={loginTheme === theme.id ? 'active' : ''} onClick={() => { setLoginTheme(theme.id); setShowThemeMenu(false) }}>
              <span style={{ background: theme.swatch }} />
              {theme.label}
            </button>)}
          </div>}
        </div>
        <span className="pill premium-pill">CLIENT PORTAL</span>
      </div>
    </header>
    <main className="login-layout login-layout-centered">
      <section className="login-card neo" aria-label="Sign in">
        <div className="login-card-brand"><Brand /></div>
        <form onSubmit={submit} className="form-stack">
          <label>Email<input name="identity" type="email" autoComplete="username" placeholder="client@cinifix.com" defaultValue="client@cinifix.com" required onChange={() => setError('')} /></label>
          <label>Password<div className="password-field"><input name="password" autoComplete="current-password" type={visible ? 'text' : 'password'} placeholder="Enter your password" defaultValue="0147" required onChange={() => setError('')} /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? 'Hide' : 'Show'}</button></div></label>
          <label className="check-label"><input name="remember" type="checkbox" defaultChecked />Remember this device</label>
          {error && <p role="alert" className="error">{error}</p>}
          <button className="primary" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}<Icon name="arrow" /></button>
        </form>
        <div className="demo-note"><Icon name="shield" /><span>Need access? <strong><a href="https://www.facebook.com/cinanyag" target="_blank" rel="noopener noreferrer">Contact administrator</a></strong></span></div>
      </section>
    </main>
    <footer className="login-footer">&copy; {new Date().getFullYear()} Sentinel AI <span>DEVELOPED BY CINIFIX TECHNOLOGIES.</span></footer>
    <button type="button" className="login-chat-launcher" aria-label="Contact administrator" onClick={() => { setShowVisitorChat(true); setVisitorStatus(''); setVisitorError('') }}>
      <span className="login-chat-glow" />
      <Icon name="chat" />
      <i />
    </button>
    {showVisitorChat && <div className="login-chat-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowVisitorChat(false) }}>
      <section className="login-chat-modal" role="dialog" aria-modal="true" aria-labelledby="visitor-chat-title">
        <header className="login-chat-header">
          <span className="login-chat-mark"><Icon name="chat" /></span>
          <div><span>SECURE COMMUNICATION</span><h2 id="visitor-chat-title">Connect with an administrator</h2><p>Tell us how we can help before you sign in.</p></div>
          <button type="button" className="login-chat-close" aria-label="Close chat" onClick={() => setShowVisitorChat(false)}>×</button>
        </header>
        <div className="login-chat-body">
          {!visitorSession ? <>
            <div className="login-chat-welcome"><strong>Hello, welcome.</strong><span>Please fill out these two details and your administrator will receive them securely.</span></div>
            <form className="login-chat-form" onSubmit={submitVisitorIntake}>
              <label>What is your name?<input value={visitorForm.name} onChange={(event) => setVisitorForm({ ...visitorForm, name: event.target.value })} placeholder="Enter your full name" maxLength="120" required /></label>
              <label>Purpose of your visit<input value={visitorForm.purpose} onChange={(event) => setVisitorForm({ ...visitorForm, purpose: event.target.value })} placeholder="How can we assist you?" maxLength="500" required /></label>
              {visitorError && <p className="login-chat-error" role="alert">{visitorError}</p>}
              <button type="submit" className="login-chat-send" disabled={visitorBusy}>{visitorBusy ? 'Sending securely...' : 'Continue to chat'}<Icon name="arrow" /></button>
            </form>
            <small className="login-chat-footer">Your visitor details are stored in the secure communication channel.</small>
          </> : <>
            <div className="visitor-chat-contact"><span className="login-chat-mark"><Icon name="shield" /></span><div><strong>{visitorSession.admin_name || 'Administrator'}</strong><small>Secure administrator channel · Online</small></div><span className="visitor-online-dot" /></div>
            <div className="visitor-chat-thread" aria-live="polite">
              {visitorMessages.map((item) => <div key={item.message_id} className={`visitor-chat-bubble ${String(item.sender_user_id) === String(visitorSession.visitor_id) ? 'outgoing' : 'incoming'}`}>{item.message && <span>{item.message}</span>}{renderVisitorAttachment(item)}<small>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div>)}
              <div ref={visitorEndRef} />
            </div>
            {visitorError && <p className="login-chat-error" role="alert">{visitorError}</p>}
            <form className="visitor-chat-composer" onSubmit={sendVisitorMessage}>
              <label className="visitor-chat-attach-button" title="Attach a file"><Icon name="paperclip" /><input type="file" accept="image/*,video/*,audio/*,.pdf,.txt,.zip,.doc,.docx,.xls,.xlsx" onChange={handleVisitorAttachment} /></label>
              <div className="visitor-chat-composer-main">
                {visitorAttachment && <div className="visitor-chat-attachment-chip"><span>{visitorAttachment.name}</span><button type="button" onClick={() => setVisitorAttachment(null)} aria-label="Remove attachment">Ã—</button></div>}
                <input value={visitorDraft} onChange={(event) => setVisitorDraft(event.target.value)} placeholder="Write to your administrator..." maxLength="2000" />
              </div>
              <button type="submit" aria-label="Send message" disabled={visitorMessageBusy || (!visitorDraft.trim() && !visitorAttachment)}><Icon name="arrow" /></button>
            </form>
            <small className="login-chat-footer">Signed in as visitor · Messages are stored securely.</small>
          </>}
        </div>
      </section>
    </div>}
  </div>
}
