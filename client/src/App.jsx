import { useEffect, useRef, useState } from 'react'
import Login from './login/login'
import Dashboard from './dashboard/dash'
import UserSettings from './dashboard/userset'
import { Brand, Icon } from './ui'
import { apiGet, apiPost, apiPut, getSession } from './api'
import { endSession, signedIn, useSaved } from './storage'
import './App.css'

const links = [
  { path: '/dashboard', label: 'Overview', icon: 'grid' },
  { path: '/settings', label: 'Account settings', icon: 'settings' },
]

const themes = [
  { id: 'daylight', label: 'Daylight Calm', swatch: '#f8f9ff' },
  { id: 'twilight', label: 'Twilight Slate', swatch: '#283541' },
  { id: 'midnight', label: 'Midnight Patrol', swatch: '#1c252e' },
  { id: 'sage', label: 'Sage Garden', swatch: '#e6eee7' },
]

function currentRoute() {
  return window.location.pathname + window.location.hash
}

function ClientCommunication({ profile }) {
  const [open, setOpen] = useState(false)
  const [admins, setAdmins] = useState([])
  const [groups, setGroups] = useState([])
  const [selectedAdmin, setSelectedAdmin] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [selectedAssistant, setSelectedAssistant] = useState(false)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const threadRef = useRef(null)
  const currentUserId = String(getSession()?.user_id || '')
  const assistantIntro = 'Hi, I am your Sentinel AI Assistant. Ask me about device status, alerts, access activity, or what to do next.'
  const isChatting = selectedAdmin || selectedGroup || selectedAssistant

  useEffect(() => {
    const thread = threadRef.current
    if (!thread) return
    thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' })
  }, [messages, loading, selectedAdmin, selectedAssistant])

  useEffect(() => {
    let active = true
    const refreshAdmins = () => Promise.all([apiGet('/communicate/people?filter=admin'), apiGet('/communicate/groups')])
      .then(([people, memberGroups]) => {
        if (!active) return
        setAdmins(people)
        setGroups(memberGroups)
        setUnreadCount(people.reduce((total, person) => total + Number(person.unread_count || 0), 0))
      })
      .catch((requestError) => { if (active && open) setError(requestError.message || 'Unable to load administrators.') })
    refreshAdmins()
    const refreshTimer = window.setInterval(refreshAdmins, 15000)
    return () => { active = false; window.clearInterval(refreshTimer) }
  }, [open, selectedGroup])

  useEffect(() => {
    if (!open || !selectedAdmin || selectedGroup || selectedAssistant) return undefined
    let active = true
    setLoading(true)
    apiGet(`/communicate/messages/${encodeURIComponent(String(selectedAdmin.user_id))}`)
      .then(async (history) => {
        if (!active) return
        setMessages(history)
        await apiPut(`/communicate/messages/${encodeURIComponent(String(selectedAdmin.user_id))}/read`)
        setUnreadCount((count) => Math.max(0, count - Number(selectedAdmin.unread_count || 0)))
      })
      .catch((requestError) => { if (active) setError(requestError.message || 'Unable to load the conversation.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [open, selectedAdmin, selectedAssistant])

  useEffect(() => {
    if (!open || !selectedGroup || selectedAssistant) return undefined
    let active = true
    setLoading(true)
    apiGet(`/communicate/groups/${encodeURIComponent(String(selectedGroup.group_id))}/messages`)
      .then((history) => { if (active) setMessages(history) })
      .catch((requestError) => { if (active) setError(requestError.message || 'Unable to load the group conversation.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [open, selectedGroup, selectedAssistant])

  useEffect(() => {
    if (selectedAdmin) {
      setSelectedGroup(null)
      setSelectedAssistant(false)
    }
  }, [selectedAdmin])

  useEffect(() => {
    if (selectedGroup) {
      setSelectedAssistant(false)
      setAttachment(null)
    }
  }, [selectedGroup])

  async function sendMessage(event) {
    event.preventDefault()
    const message = draft.trim()
    if ((!message && !attachment) || (!selectedAdmin && !selectedGroup && !selectedAssistant) || sending) return
    if (selectedAssistant) {
      const now = new Date().toISOString()
      setMessages((current) => [
        ...current,
        { message_id: `user-${Date.now()}`, sender_user_id: currentUserId, message, created_at: now },
        { message_id: `assistant-${Date.now()}`, sender_user_id: 'assistant', message: assistantReply(message), created_at: now },
      ])
      setDraft('')
      return
    }
    setSending(true)
    setError('')
    try {
      const created = selectedGroup
        ? await apiPost('/communicate/groups/messages', { group_id: selectedGroup.group_id, message })
        : await apiPost('/communicate/messages', {
          recipient_user_id: String(selectedAdmin.user_id),
          message,
          attachment_data: attachment?.data || '',
          attachment_name: attachment?.name || '',
          attachment_type: attachment?.type || '',
          attachment_size: attachment?.size || 0,
        })
      setMessages((current) => [...current, created])
      setDraft('')
      setAttachment(null)
    } catch (requestError) {
      setError(requestError.message || 'Unable to send message.')
    } finally {
      setSending(false)
    }
  }

  function handleAttachment(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      setError('Attachments must be 8 MB or smaller.')
      return
    }
    const supported = /^(image|video|audio)\//.test(file.type) || ['application/pdf', 'text/plain', 'application/zip', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(file.type)
    if (!supported) {
      setError('This file type is not supported.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setAttachment({ data: String(reader.result || ''), name: file.name, type: file.type || 'application/octet-stream', size: file.size })
      setError('')
    }
    reader.onerror = () => setError('Unable to read that file.')
    reader.readAsDataURL(file)
  }

  function renderAttachment(item) {
    if (!item.attachment_data) return null
    if (item.attachment_type?.startsWith('image/')) return <a href={item.attachment_data} target="_blank" rel="noreferrer"><img className="client-chat-attachment-image" src={item.attachment_data} alt={item.attachment_name || 'Attached image'} /></a>
    if (item.attachment_type?.startsWith('video/')) return <video className="client-chat-attachment-media" src={item.attachment_data} controls preload="metadata" />
    if (item.attachment_type?.startsWith('audio/')) return <audio className="client-chat-attachment-audio" src={item.attachment_data} controls />
    return <a className="client-chat-attachment-file" href={item.attachment_data} download={item.attachment_name || 'attachment'}>{item.attachment_name || 'Download attachment'}</a>
  }

  function initials(person) {
    return (person?.full_name || person?.email || 'Admin').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  }

  function openAssistant() {
    setSelectedAdmin(null)
    setSelectedGroup(null)
    setSelectedAssistant(true)
    setAttachment(null)
    setError('')
    setMessages([{ message_id: 'assistant-welcome', sender_user_id: 'assistant', message: assistantIntro, created_at: new Date().toISOString() }])
  }

  function resetChat() {
    setSelectedAdmin(null)
    setSelectedGroup(null)
    setSelectedAssistant(false)
    setMessages([])
    setDraft('')
    setAttachment(null)
    setError('')
  }

  function assistantReply(message) {
    const text = message.toLowerCase()
    if (text.includes('alert') || text.includes('warning')) return 'Check Recent Activity first, then verify whether the related device is online. If the alert is unusual, message an admin from this same panel.'
    if (text.includes('device') || text.includes('sensor') || text.includes('online')) return 'Open the Device Status card on the dashboard. Online devices are marked with a live status dot, and offline devices show their last seen time.'
    if (text.includes('group') || text.includes('admin') || text.includes('message')) return 'Use Back to all conversations, then choose an administrator or approved group to send a secure message.'
    if (text.includes('motion') || text.includes('movement')) return 'Motion details appear in Residence Status and Recent Activity. If motion is unexpected, keep monitoring and contact an admin for manual review.'
    return 'I can help you read dashboard status, understand alerts, check devices, and decide whether to contact an admin. Try asking about alerts, motion, devices, or secure messages.'
  }

  return <>
    <button type="button" className="client-chat-launcher" onClick={() => setOpen(true)} aria-label="Open AI Assistant chat">
      <span className="client-chat-launcher-glow" aria-hidden="true" />
      <i aria-hidden="true" />
      <Icon name="bot" size={24} />
      <span>AI Assistant</span>
      {unreadCount > 0 && <b className="client-chat-unread">{unreadCount > 99 ? '99+' : unreadCount}</b>}
    </button>
    {open && <div className="client-chat-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
      <section className={`client-chat-modal ${isChatting ? 'is-chatting' : ''}`} role="dialog" aria-modal="true" aria-labelledby="client-chat-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="client-chat-header">
          <div className="client-chat-mark"><Icon name={selectedAssistant ? 'bot' : 'chat'} size={22} /></div>
          <div><span>{selectedAssistant ? 'AI ASSISTANT' : 'SECURE COMMUNICATION'}</span><h2 id="client-chat-title">{selectedAssistant ? 'Sentinel AI Assistant' : selectedGroup ? selectedGroup.group_name : selectedAdmin ? selectedAdmin.full_name || selectedAdmin.email : 'Connect with an admin'}</h2><p>{selectedAssistant ? 'Ask about alerts, devices, motion, and next actions.' : selectedGroup ? 'Shared messages with your approved group members.' : selectedAdmin ? 'Private secure channel with your administrator.' : 'Private messages saved to your Sentinel workspace.'}</p></div>
          <button type="button" className="client-chat-close" onClick={() => setOpen(false)} aria-label="Close admin chat">×</button>
        </header>
        {isChatting && <button type="button" className="client-chat-back" onClick={resetChat}><Icon name="arrow" size={16} />Back to all conversations</button>}
        <div className="client-ai-assistant-option">
          <span className="client-chat-label">AI ASSISTANT</span>
          <button type="button" onClick={openAssistant}>
            <span className="client-chat-avatar client-ai-avatar"><Icon name="bot" size={17} /><i className="online" /></span>
            <span><strong>Sentinel AI Assistant</strong><small>Online now - Dashboard help</small></span>
          </button>
        </div>
        <div className="client-chat-admins">
          <span className="client-chat-label">AVAILABLE ADMINS</span>
          <div className="client-chat-admin-list">
            {admins.map((admin) => <button type="button" key={admin.user_id} className={selectedAdmin?.user_id === admin.user_id ? 'active' : ''} onClick={() => setSelectedAdmin(admin)}><span className="client-chat-avatar">{initials(admin)}<i className={admin.online ? 'online' : ''} /></span><span><strong>{admin.full_name || admin.email}</strong><small>{admin.online ? 'Online now' : 'Available'} · Administrator</small></span></button>)}
            {!loading && !admins.length && <p className="client-chat-empty">No administrator accounts are available yet.</p>}
          </div>
        </div>
          {groups.length > 0 && <div className="client-chat-group-list"><span className="client-chat-label">YOUR APPROVED GROUPS</span>{groups.map((group) => <button type="button" key={group.group_id} className={selectedGroup?.group_id === group.group_id ? 'active' : ''} onClick={() => { setSelectedAdmin(null); setSelectedGroup(group); setError('') }}><span className="client-chat-avatar"><Icon name="user" size={15} /></span><span><strong>{group.group_name}</strong><small>{group.member_count} members · Shared channel</small></span></button>)}</div>}
        <div ref={threadRef} className="client-chat-thread" aria-live="polite">
          {loading && <p className="client-chat-empty">Securing your conversation...</p>}
          {!loading && selectedAssistant && !messages.length && <p className="client-chat-empty">{assistantIntro}</p>}
          {!loading && selectedAdmin && !selectedGroup && !messages.length && <p className="client-chat-empty">Start a private conversation with {selectedAdmin.full_name || 'your administrator'}.</p>}
          {!loading && selectedGroup && !messages.length && <p className="client-chat-empty">No group messages yet. Start the shared conversation.</p>}
          {!loading && messages.map((item) => <div key={item.message_id} className={`client-chat-bubble ${String(item.sender_user_id) === currentUserId ? 'outgoing' : 'incoming'}`}>{item.message && <span>{item.message}</span>}{renderAttachment(item)}<small>{selectedGroup && <strong>{item.sender_name || (String(item.sender_user_id) === currentUserId ? 'You' : 'Member')} · </strong>}{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div>)}
        </div>
        {error && <p className="client-chat-error">{error}</p>}
      <form className="client-chat-composer" onSubmit={sendMessage}>
        {selectedAdmin && <label className="client-chat-attach-button" title="Attach a file"><Icon name="paperclip" size={18} /><input type="file" accept="image/*,video/*,audio/*,.pdf,.txt,.zip,.doc,.docx,.xls,.xlsx" onChange={handleAttachment} disabled={sending} /></label>}
        <div className="client-chat-composer-main">
          {attachment && <div className="client-chat-attachment-chip"><span>{attachment.name}</span><button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment">×</button></div>}
          <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} placeholder={selectedAssistant ? 'Ask the AI Assistant...' : selectedGroup ? 'Write to your group...' : selectedAdmin ? 'Write to your administrator...' : 'Select an administrator'} disabled={(!selectedAdmin && !selectedGroup && !selectedAssistant) || sending} autoFocus />
        </div>
        <button type="submit" disabled={(!draft.trim() && !attachment) || (!selectedAdmin && !selectedGroup && !selectedAssistant) || sending} aria-label="Send message"><Icon name="arrow" size={18} /></button>
      </form>
        <small className="client-chat-footer">Signed in as {profile.email} · End-to-end workspace channel</small>
      </section>
    </div>}
  </>
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(signedIn)
  const [route, setRoute] = useState(currentRoute)
  const [profile, setProfile] = useSaved('profile', {
    name: 'Sarah Chen',
    email: 'sarah.chen@example.com',
    phone: '',
    residence: 'Hillside Residence - Unit 402',
  })
  const [preferences, setPreferences] = useSaved('preferences', { alerts: true, timeout: '15' })
  const [portalTheme, setPortalTheme] = useSaved('theme', 'daylight')
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const [notice, setNotice] = useState('')

  function navigate(path, replace = false) {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
    setRoute(path)
  }

  function logout() {
    endSession()
    setAuthenticated(false)
    navigate('/login', true)
  }

  useEffect(() => {
    function sync() {
      const active = signedIn()
      setAuthenticated(active)
      const path = window.location.pathname
      if (!active && path !== '/login') navigate('/login', true)
      else if (active && !['/dashboard', '/settings'].includes(path)) navigate('/dashboard', true)
      else setRoute(currentRoute())
    }

    sync()
    window.addEventListener('popstate', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  useEffect(() => {
    document.title = `${route.startsWith('/settings') ? 'Account settings' : route.startsWith('/login') ? 'Sign in' : 'Overview'} | Sentinel AI`
    const anchor = route.split('#')[1]
    if (anchor) document.getElementById(anchor)?.scrollIntoView({ block: 'start' })
    else window.scrollTo(0, 0)
  }, [route])

  useEffect(() => {
    if (!authenticated) return
    let timer
    function reset() {
      clearTimeout(timer)
      timer = setTimeout(() => {
        endSession()
        setAuthenticated(false)
        window.history.replaceState({}, '', '/login')
        setRoute('/login')
      }, Number(preferences.timeout) * 60000)
    }

    reset()
    window.addEventListener('pointerdown', reset)
    window.addEventListener('keydown', reset)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pointerdown', reset)
      window.removeEventListener('keydown', reset)
    }
  }, [authenticated, preferences.timeout])

  useEffect(() => {
    if (!authenticated) return undefined
    const sendHeartbeat = () => { apiPost('/communicate/heartbeat').catch(() => undefined) }
    sendHeartbeat()
    const heartbeat = window.setInterval(sendHeartbeat, 60000)
    return () => window.clearInterval(heartbeat)
  }, [authenticated])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  if (!authenticated || route.startsWith('/login')) {
    return <Login onAuthenticated={(session) => {
      if (session) setProfile({ ...profile, name: session.full_name || profile.name, email: session.email || profile.email })
      setAuthenticated(true)
      navigate('/dashboard', true)
    }} />
  }

  function follow(event, path) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    navigate(path)
  }

  return (
    <div className={`portal premium-portal theme-${portalTheme}`}>
      <a className="skip-link" href="#content">Skip to content</a>
      <aside className="sidebar">
        <Brand />
        <p className="eyebrow nav-heading">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {links.map((link) => (
            <a key={link.path} href={link.path} onClick={(event) => follow(event, link.path)} aria-current={route === link.path ? 'page' : undefined}>
              <Icon name={link.icon} />
              <span>{link.label}</span>
              {route === link.path && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="logout" onClick={logout}><Icon name="logout" />Log out</button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <span className="breadcrumb">MY RESIDENCE <span>/</span> {route.startsWith('/settings') ? 'ACCOUNT' : 'OVERVIEW'}</span>
          <div className="topbar-right">
            <div className="theme-picker">
              <button type="button" className="theme-picker-button" aria-label="Change dashboard color theme" onClick={() => setShowThemeMenu((visible) => !visible)}>
                <span className="theme-orb" aria-hidden="true" />
              </button>
              {showThemeMenu && (
                <div className="theme-menu">
                  <strong>Dashboard atmosphere</strong>
                  {themes.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      className={portalTheme === theme.id ? 'active' : ''}
                      onClick={() => {
                        setPortalTheme(theme.id)
                        setShowThemeMenu(false)
                        setNotice(`${theme.label} theme applied.`)
                      }}
                    >
                      <span style={{ background: theme.swatch }} />
                      {theme.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="profile-button" onClick={() => navigate('/settings')} aria-label="Account settings">
              <span className="avatar">{profile.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
              <span>{profile.name}<small>Homeowner</small></span>
            </button>
          </div>
        </header>

        <main id="content" tabIndex={-1}>
          {route.startsWith('/settings')
            ? <UserSettings profile={profile} onSave={setProfile} preferences={preferences} setPreferences={setPreferences} onLogout={logout} notify={setNotice} />
            : <Dashboard profile={profile} notify={setNotice} navigate={navigate} />}
        </main>
        <footer className="workspace-footer">SENTINEL AI / PERSONAL SECURITY<span>Sample telemetry - No live connection</span></footer>
      </div>

      <ClientCommunication profile={profile} />
      {notice && <div className="toast" role="status"><Icon name="check" />{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}>x</button></div>}
    </div>
  )
}
