import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../api'
import { Icon, PremiumLoader } from '../ui'

const emptyDashboard = {
  devices: [],
  latestReadings: [],
  sessions: [],
  voiceInteractions: [],
  alerts: [],
  activities: [],
  sensorEvents: [],
}

export default function Dashboard({ profile, notify }) {
  const [data, setData] = useState(emptyDashboard)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

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

    <PerimeterActivity events={data.sensorEvents} loading={loading} onRefresh={() => loadDashboard(true)} />
  </>
}

function PerimeterActivity({ events, loading, onRefresh }) {
  const [range, setRange] = useState('today')
  const [view, setView] = useState('chart')
  const [expanded, setExpanded] = useState(false)
  const now = Date.now()
  const rangeStart = range === 'today'
    ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
    : now - 7 * 24 * 60 * 60 * 1000
  const filtered = events
    .filter(event => dateValue(event) >= rangeStart && dateValue(event) <= now)
    .sort((a, b) => dateValue(b) - dateValue(a))
  const total = filtered.length
  const verified = filtered.filter(event => /verified|authorized|confirmed/i.test(`${event.title} ${event.detail} ${event.tone}`)).length
  const noise = filtered.filter(event => /noise|filtered|passive/i.test(`${event.title} ${event.detail} ${event.tone}`)).length
  const points = chartPoints(filtered, range)
  const latest = filtered.slice(0, 5)

  return <section className={`perimeter-card card neo ${expanded ? 'perimeter-expanded' : ''}`}>
    <div className="perimeter-header">
      <div>
        <div className="perimeter-title"><span className="perimeter-icon"><Icon name="pulse" size={19} /></span><h2>Perimeter Activity &amp; Motion Log</h2><span className="pill">HC-SR501</span></div>
        <p>Live Convex telemetry from the HC-SR501 sensor</p>
      </div>
      <div className="perimeter-actions">
        <button type="button" className="secondary" onClick={() => setExpanded(value => !value)}><Icon name={expanded ? 'close' : 'expand'} size={16} />{expanded ? 'Close' : 'Expand'}</button>
        <div className="perimeter-view-toggle" role="group" aria-label="Motion log view">
          <button type="button" className={view === 'chart' ? 'active' : ''} onClick={() => setView('chart')} aria-label="Chart view"><Icon name="pulse" size={16} /></button>
          <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view"><Icon name="list" size={16} /></button>
        </div>
        <div className="perimeter-range" role="group" aria-label="Motion log range">
          <button type="button" className={range === 'today' ? 'active' : ''} onClick={() => setRange('today')}>Today</button>
          <button type="button" className={range === '7days' ? 'active' : ''} onClick={() => setRange('7days')}>7 Days</button>
        </div>
        <button type="button" className="icon-button" onClick={onRefresh} disabled={loading} aria-label="Refresh motion log" title="Refresh motion log"><Icon name="refresh" size={16} /></button>
      </div>
    </div>

    <div className="perimeter-stats">
      <Metric label="Total Triggers" value={total} detail="PIR motion events" tone="lime" />
      <Metric label="AI Verified" value={verified} detail="Cadence confirmed" tone="blue" />
      <Metric label="Filtered Noise" value={noise} detail="Thermal rejected" tone="muted" />
    </div>

    {loading ? <PremiumLoader label="Syncing sensor telemetry" /> : view === 'chart' ? <MotionChart points={points} /> : <MotionList events={latest} />}
    {view === 'chart' && <MotionList events={latest} />}
    <div className="perimeter-footer"><span><i className="legend-dot motion" />PIR Motion Triggers</span><span><i className="legend-dot verified" />AI Verified Visits</span><small>{total ? `Showing ${Math.min(total, 5)} of ${total} motion events` : 'No motion events in this range'}</small></div>
  </section>
}

function Metric({ label, value, detail, tone }) {
  return <div className="perimeter-metric"><span className={`metric-dot ${tone}`} /> <span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
}

function MotionChart({ points }) {
  const coordinates = points.map((value, index) => `${(index / Math.max(1, points.length - 1)) * 100},${92 - Math.min(value, 10) * 7}`).join(' ')
  const area = `0,100 ${coordinates} 100,100`
  return <div className="motion-chart" aria-label="Motion event chart">
    <div className="chart-y-axis"><span>10</span><span>5</span><span>0</span></div>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img"><defs><linearGradient id="motion-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#c3f56a" stopOpacity=".35" /><stop offset="1" stopColor="#c3f56a" stopOpacity="0" /></linearGradient></defs><path d={`M ${area}`} fill="url(#motion-fill)" /><polyline points={coordinates} fill="none" stroke="#c3f56a" strokeWidth=".8" vectorEffect="non-scaling-stroke" /></svg>
    <div className="chart-x-axis"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>Now</span></div>
  </div>
}

function MotionList({ events }) {
  return <div className="motion-list"><div className="motion-list-heading"><span>RECENTLY SAVED MOTION</span><span>CONVEX</span></div>{events.length ? events.map(event => <div className="motion-list-row" key={event.id}><span className="motion-event-name"><i className="legend-dot motion" />{event.title || 'PIR motion detected'} <small>{event.location || event.detail || 'Front entrance'}</small></span><time>{formatTime(event.created_at || event.createdAt)}</time></div>) : <EmptyState text="No sensor motion has been saved for this range." />}</div>
}

function dateValue(event) {
  const value = event.created_at || event.createdAt || event.recorded_at || event.recordedAt
  const timestamp = new Date(value || 0).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function chartPoints(events, range) {
  const buckets = Array.from({ length: range === 'today' ? 24 : 14 }, () => 0)
  const span = range === 'today' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
  const start = Date.now() - span
  events.forEach(event => {
    const position = Math.floor(((dateValue(event) - start) / span) * buckets.length)
    if (position >= 0 && position < buckets.length) buckets[position] += 1
  })
  return buckets
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
