import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import './App.css'
import { Badge, Button, Dialog, Icon } from './components/ui.jsx'
import HomeDashboard from './screens/home.jsx'
import LiveSecurityMonitor from './screens/live.jsx'
import VisitorManagement from './screens/visitor.jsx'
import ConversationalVerification from './screens/converse.jsx'
import Settings from './screens/Settings.jsx'
import { initialState, sentinelReducer } from './state/sentinel.js'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

const navItems = [
  { path: '/', label: 'Overview', icon: 'home' },
  { path: '/monitor', label: 'Monitor', icon: 'radar' },
  { path: '/intercom', label: 'Intercom', icon: 'mic' },
  { path: '/visitors', label: 'Visitors', icon: 'users' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
]

function getRouteDetails(currentPath = window.location.pathname) {
  const [pathname, query = ''] = currentPath.split('?')
  const search = new URLSearchParams(query)
  return { pathname, search }
}

function App() {
  const [state, dispatch] = useReducer(sentinelReducer, initialState)
  const [route, setRoute] = useState(() => window.location.pathname || '/')
  const [dialog, setDialog] = useState(null)
  const [motionAlert, setMotionAlert] = useState(null)
  const lastMotionAlertRef = useRef('')

  useEffect(() => {
    const handlePopState = () => setRoute(window.location.pathname || '/')
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    let active = true
    let lastTimestamp = ''

    async function refreshLiveReading() {
      try {
        const [latestResponse, activityResponse] = await Promise.all([
          fetch(`${API_URL}/iot/latest`),
          fetch(`${API_URL}/iot/activity`),
        ])
        if (!latestResponse.ok) return
        const data = await latestResponse.json()
        const timestamp = data?.reading?.created_at || ''
        if (activityResponse.ok) {
          const activity = await activityResponse.json()
          if (active && Array.isArray(activity.events)) send('LIVE_ACTIVITY', { events: activity.events })
        }
        if (!active || !timestamp || timestamp === lastTimestamp) return
        lastTimestamp = timestamp
        send('LIVE_READING', { device: data.device, reading: data.reading })
      } catch {
        // Keep the demo UI running if the backend is offline.
      }
    }

    refreshLiveReading()
    const timer = window.setInterval(refreshLiveReading, 2000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  const navigate = (nextRoute) => {
    const safeRoute = nextRoute.startsWith('/') ? nextRoute : `/${nextRoute}`
    window.history.pushState({}, '', safeRoute)
    setRoute(safeRoute)
  }

  const send = (type, payload = {}) => {
    const action = {
      type,
      id: payload.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
      time: payload.time ?? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ...payload,
    }
    dispatch(action)
  }

  const openDialog = (type, data = null) => setDialog({ type, data })
  const closeDialog = () => setDialog(null)

  useEffect(() => {
    const latest = state.events.find((event) => /motion|pir|sensor/i.test(`${event.title} ${event.detail}`))
    if (!state.motion || !latest || latest.id === lastMotionAlertRef.current) return
    lastMotionAlertRef.current = latest.id
    setMotionAlert(latest)
  }, [state.events, state.motion])

  const currentPage = useMemo(() => {
    const { pathname, search } = getRouteDetails(route)
    const tab = search.get('tab') || 'scheduled'

    switch (pathname) {
      case '/monitor':
        return <LiveSecurityMonitor state={state} send={send} navigate={navigate} />
      case '/intercom':
        return <ConversationalVerification state={state} send={send} openDialog={openDialog} />
      case '/visitors':
        return <VisitorManagement state={state} send={send} openDialog={openDialog} initialTab={tab} />
      case '/settings':
        return <Settings state={state} send={send} />
      default:
        return <HomeDashboard state={state} send={send} navigate={navigate} openDialog={openDialog} />
    }
  }, [route, state])

  const renderDialog = () => {
    if (!dialog) return null

    if (dialog.type === 'events') {
      return (
        <Dialog title="Security event log" onClose={closeDialog}>
          <div className="dialog-content">
            <ol className="timeline compact-timeline">
              {state.events.map((event) => (
                <li key={event.id}>
                  <span className={`timeline-dot ${event.tone || ''}`}>
                    <Icon name={event.icon || 'check'} size={13} />
                  </span>
                  <div>
                    <strong>{event.title}</strong>
                    <p>{event.detail}</p>
                  </div>
                  <time>{event.time}</time>
                </li>
              ))}
            </ol>
          </div>
        </Dialog>
      )
    }

    if (dialog.type === 'visitor') {
      const visitor = dialog.data || {
        id: 'new-visitor',
        name: 'New visitor',
        company: 'New company',
        schedule: 'Flexible schedule',
        rule: 'Safe phrase verification',
        detail: 'Manual approval before entry.',
        status: 'authorized',
        initials: 'NV',
        lastVisit: 'Just now',
      }

      return (
        <Dialog title={visitor.id === 'new-visitor' ? 'Add authorized visitor' : `Edit ${visitor.name}`} onClose={closeDialog}>
          <div className="dialog-content visitor-dialog">
            <div className="profile-card compact-profile">
              <span className={`initial-avatar avatar-${visitor.id === 'elena' ? 'sky' : visitor.id === 'david' ? 'amber' : 'teal'}`}>
                {visitor.initials || visitor.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <h3>{visitor.name}</h3>
                <p>{visitor.company}</p>
              </div>
            </div>
            <dl className="details-list compact-details">
              <div><dt>Schedule</dt><dd>{visitor.schedule}</dd></div>
              <div><dt>Rule</dt><dd>{visitor.rule}</dd></div>
              <div><dt>Current status</dt><dd>{visitor.status}</dd></div>
            </dl>
            <div className="dialog-actions">
              <Button onClick={closeDialog}>Close</Button>
              <Button variant="primary" onClick={() => {
                const nextVisitor = { ...visitor, id: visitor.id || `visitor-${Date.now()}` }
                send('SAVE_VISITOR', { visitor: nextVisitor })
                closeDialog()
              }}>Save changes</Button>
            </div>
          </div>
        </Dialog>
      )
    }

    if (dialog.type === 'revoke') {
      const visitor = dialog.data
      return (
        <Dialog title="Revoke visitor access" onClose={closeDialog}>
          <div className="dialog-content">
            <p>Revoke access for {visitor?.name || 'this visitor'} and require a re-authorization before the next visit.</p>
            <div className="dialog-actions">
              <Button onClick={closeDialog}>Cancel</Button>
              <Button variant="danger" onClick={() => {
                send('REVOKE', { visitorId: visitor.id })
                closeDialog()
              }}>Revoke access</Button>
            </div>
          </div>
        </Dialog>
      )
    }

    if (dialog.type === 'unlock') {
      return (
        <Dialog title="Manual porch unlock" onClose={closeDialog}>
          <div className="dialog-content">
            <p>Allow a manual override for the porch lock while the visitor is being verified.</p>
            <div className="dialog-actions">
              <Button onClick={closeDialog}>Cancel</Button>
              <Button variant="primary" onClick={() => {
                send('UNLOCK')
                closeDialog()
              }}>Unlock porch</Button>
            </div>
          </div>
        </Dialog>
      )
    }

    return null
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-mark"><Icon name="shield" size={20} /></span>
          <div>
            <p className="eyebrow">SENTINEL</p>
            <h1>AI Security</h1>
          </div>
        </div>

        <nav className="nav-stack" aria-label="Main navigation">
          {navItems.map(({ path, label, icon }) => {
            const { pathname } = getRouteDetails(route)
            const active = pathname === path
            return (
              <button
                key={path}
                type="button"
                className={`nav-button ${active ? 'active' : ''}`}
                onClick={() => navigate(path)}
              >
                <Icon name={icon} size={17} />
                <span>{label}</span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-card">
          <p className="eyebrow">SYSTEM HEALTH</p>
          <div className="side-row">
            <span>Network</span>
            <Badge tone="success" icon="wifi">Online</Badge>
          </div>
          <div className="side-row">
            <span>Lock state</span>
            <Badge tone={state.locked ? 'neutral' : 'success'} icon={state.locked ? 'lock' : 'unlock'}>
              {state.locked ? 'Locked' : 'Open'}
            </Badge>
          </div>
        </div>
      </aside>

      <div className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">FRONT ENTRANCE</p>
            <h2>Sentinel control center</h2>
          </div>
          <div className="topbar-actions">
            <Badge icon="activity" tone={state.mode === 'disarmed' ? 'neutral' : 'success'}>
              {state.mode === 'disarmed' ? 'Standby' : 'Live guard'}
            </Badge>
            <Button variant="primary" icon="lock" onClick={() => send('LOCKDOWN')}>
              Lockdown
            </Button>
          </div>
        </header>

        <main className="page-shell">{currentPage}</main>
      </div>

      {motionAlert && (
        <div className="motion-alert-backdrop" role="presentation" onClick={() => setMotionAlert(null)}>
          <section className="motion-alert-modal" role="dialog" aria-modal="true" aria-labelledby="motion-alert-title" onClick={(event) => event.stopPropagation()}>
            <div className="motion-alert-icon"><Icon name="radar" size={24} /></div>
            <div className="motion-alert-body">
              <div className="motion-alert-head">
                <div>
                  <p className="premium-kicker">Motion Detection Alert</p>
                  <h2 id="motion-alert-title">PIR motion detected at front entrance</h2>
                  <p>ESP32 porch node published a live HC-SR501 trigger and saved it to the activity log.</p>
                </div>
                <button type="button" className="premium-modal-close" onClick={() => setMotionAlert(null)} aria-label="Close motion alert">x</button>
              </div>
              <div className="motion-alert-grid">
                <span><small>Sensor</small><strong>HC-SR501 PIR</strong></span>
                <span><small>GPIO</small><strong>27 High</strong></span>
                <span><small>Time</small><strong>{motionAlert.time}</strong></span>
              </div>
              <div className="motion-alert-actions">
                <Button onClick={() => setMotionAlert(null)}>Dismiss</Button>
                <Button variant="primary" onClick={() => { setMotionAlert(null); navigate('/monitor') }}>Open Live Radar</Button>
              </div>
            </div>
          </section>
        </div>
      )}

      {renderDialog()}
    </div>
  )
}

export default App
