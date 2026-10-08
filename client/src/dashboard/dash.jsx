import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet } from '../api'
import { Icon, PremiumLoader } from '../ui'

const emptyDashboard = {
  devices: [],
  latestReadings: [],
  sessions: [],
  voiceInteractions: [],
  alerts: [],
  activities: [],
}
const ACTIVITIES_PER_PAGE = 4

export default function Dashboard({ profile, notify, navigate }) {
  const [data, setData] = useState(emptyDashboard)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [securityCode, setSecurityCode] = useState(() => getSecurityCode(profile))
  const [showSecurityCode, setShowSecurityCode] = useState(false)
  const [activityPage, setActivityPage] = useState(1)
  const securityCodeTimer = useRef(null)

  const loadDashboard = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      setData({ ...emptyDashboard, ...await apiGet('/dashboard') })
      if (silent) notify('Dashboard refreshed.')
    } catch (requestError) {
      setError(requestError.message || 'Unable to load dashboard data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [notify])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const onlineDevices = data.devices.filter((device) => device.is_online)
  const latestReading = data.latestReadings[0]
  const latestMotion = data.latestReadings.some((reading) => reading.motion_detected)
  const activityPageCount = Math.max(1, Math.ceil(data.activities.length / ACTIVITIES_PER_PAGE))
  const visibleActivities = data.activities.slice((activityPage - 1) * ACTIVITIES_PER_PAGE, activityPage * ACTIVITIES_PER_PAGE)

  useEffect(() => {
    setActivityPage(page => Math.min(page, activityPageCount))
  }, [activityPageCount])

  const copySecurityCode = async () => {
    try {
      await navigator.clipboard.writeText(securityCode)
      notify('Security code copied.')
    } catch {
      notify('Security code is ready to use.')
    }
  }

  const revealSecurityCode = () => {
    if (securityCodeTimer.current) window.clearTimeout(securityCodeTimer.current)
    const nextCode = generateSecurityCode(profile)
    setSecurityCode(nextCode)
    setShowSecurityCode(true)
    securityCodeTimer.current = window.setTimeout(() => {
      setShowSecurityCode(false)
      setSecurityCode(generateSecurityCode(profile))
      securityCodeTimer.current = null
    }, 3000)
  }

  useEffect(() => () => {
    if (securityCodeTimer.current) window.clearTimeout(securityCodeTimer.current)
  }, [])

  return <>
    <div className="page-heading">
      <div>
        <span className="eyebrow">YOUR HOME, AT A GLANCE</span>
        <h1>Hello, {profile.name.split(' ')[0]}<span className="lime">.</span></h1>
        <p>Live device health, alerts, access decisions, and recent perimeter activity.</p>
      </div>
      <div className="heading-actions">
        <span className="date-tag">{new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        <button className="secondary refresh-button" onClick={() => loadDashboard(true)} disabled={loading || refreshing}>
          <Icon name="pulse" />{refreshing ? 'Refreshing' : 'Refresh'}
        </button>
      </div>
    </div>

    {error ? <div className="error dashboard-error" role="alert">{error}</div> : null}

    <section className="hero-card neo residence-card">
      <div>
        <span className="eyebrow lime">{latestMotion ? 'MOTION RECENTLY DETECTED' : 'RESIDENCE STATUS'}</span>
        <h2>{latestMotion ? 'Frontline activity is being monitored' : 'Your monitored spaces are calm'}</h2>
        <p>{latestReading ? `Latest audio level is ${latestReading.audio_level ?? 0}. Motion sensor reports ${latestReading.motion_detected ? 'active movement' : 'no movement'}.` : 'Sensor readings will appear as soon as your ESP32 posts telemetry.'}</p>
      </div>
      <div className="hero-shield">
        <Icon name={latestMotion ? 'pulse' : 'shield'} size={72} />
        <span>{onlineDevices.length ? 'CONNECTED' : 'WAITING'}</span>
      </div>
    </section>

    <div className="dashboard-grid client-dashboard-grid">
      <section className="card neo security-code-card">
        <div className="card-row">
          <h2><Icon name="shield" />Security Code</h2>
          <span className="pill">AUTO-GENERATED</span>
        </div>
        <div className="security-code-content">
          <span className="security-code-mark"><Icon name="key" size={21} /></span>
          <div className="security-code-copy">
            <span className="eyebrow">PRIVATE ACCOUNT CODE</span>
            <strong>{showSecurityCode ? securityCode : '**'}</strong>
            <p>Use this code when confirming your identity with an administrator.</p>
          </div>
          <div className="security-code-actions">
            <button type="button" className="secondary" onClick={revealSecurityCode} title="Show security code for 3 seconds">
              <Icon name="key" size={16} />
              Show
            </button>
            <button type="button" className="primary" onClick={copySecurityCode} title="Copy security code">
              <Icon name="copy" size={16} />Copy
            </button>
          </div>
        </div>
      </section>

    </div>

    <section className="card neo activity">
      <div className="card-row">
        <h2>Recent Activity</h2>
        <button className="text-button" onClick={() => navigate('/settings')}>Account settings<Icon name="arrow" /></button>
      </div>
      {loading ? <PremiumLoader label="Loading activity" /> : data.activities.length ? visibleActivities.map((activity, index) => (
        <div className="activity-row" key={activity.attempt_id || activity.id || `${activity.attempt_number}-${index}`}>
          <span>{formatClock(activity.created_at || activity.attempt_time)}</span>
          <strong>{activity.reason || activity.result || 'Account activity recorded'}</strong>
          <span className="pill">{activity.result || 'Activity'}</span>
        </div>
      )) : <EmptyState text="No account activity has been recorded yet." />}
      {!loading && data.activities.length > 0 && <div className="activity-pagination">
        <span>Page <strong>{activityPage}</strong> of <strong>{activityPageCount}</strong></span>
        <div>
          <button type="button" className="secondary" onClick={() => setActivityPage(page => Math.max(1, page - 1))} disabled={activityPage === 1} aria-label="Previous activity page">
            <span className="pagination-previous"><Icon name="arrow" size={16} /></span>Previous
          </button>
          <button type="button" className="primary" onClick={() => setActivityPage(page => Math.min(activityPageCount, page + 1))} disabled={activityPage === activityPageCount} aria-label="Next activity page">
            Next<Icon name="arrow" size={16} />
          </button>
        </div>
      </div>}
    </section>
  </>
}

function getSecurityCode(profile) {
  const identity = profile?.user_id || profile?.id || profile?.email || 'account'
  const storageKey = `sentinel-client:security-code:${identity}`

  try {
    const saved = localStorage.getItem(storageKey)
    if (/^\d{2}$/.test(saved || '')) return saved
    return generateSecurityCode(profile)
  } catch {
    return '00'
  }
}

function generateSecurityCode(profile) {
  const identity = profile?.user_id || profile?.id || profile?.email || 'account'
  const storageKey = `sentinel-client:security-code:${identity}`
  const values = new Uint32Array(1)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values)
  else values[0] = Math.floor(Math.random() * 0xffffffff)
  const generated = String(10 + (values[0] % 90))
  try { localStorage.setItem(storageKey, generated) } catch { /* browser storage may be unavailable */ }
  return generated
}

function Panel({ className = '', title, icon, badge, loading, empty, emptyText, children }) {
  return (
    <section className={`card neo ${className}`.trim()}>
      <div className="card-row">
        <h2><Icon name={icon} />{title}</h2>
        <span className="pill">{badge}</span>
      </div>
      {loading ? <PremiumLoader label="Syncing device status" /> : empty ? <EmptyState text={emptyText} /> : children}
    </section>
  )
}

function EmptyState({ text }) {
  return <p className="empty-state">{text}</p>
}

function formatTime(value) {
  if (!value) return 'not recorded'
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatClock(value) {
  if (!value) return '--:--'
  return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}
