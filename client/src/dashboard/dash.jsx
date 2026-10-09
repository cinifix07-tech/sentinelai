import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost } from '../api'
import { Icon, PremiumLoader } from '../ui'

const emptyDashboard = {
  devices: [],
  latestReadings: [],
  sessions: [],
  voiceInteractions: [],
  alerts: [],
  activities: [],
  sensorEvents: [],
  securityState: { mode: 'away', muted: false },
}

export default function Dashboard({ profile, notify }) {
  const [data, setData] = useState(emptyDashboard)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [controlBusy, setControlBusy] = useState('')
  const [motionAlert, setMotionAlert] = useState(null)

  const loadDashboard = useCallback(async (silent = false, announce = true) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const [dashboard, modeResponse] = await Promise.all([apiGet('/dashboard'), apiGet('/iot/client-mode')])
      setData({ ...emptyDashboard, ...dashboard, securityState: modeResponse.state || emptyDashboard.securityState })
      if (silent && announce) notify('Dashboard refreshed.')
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

  useEffect(() => {
    const timer = window.setInterval(() => loadDashboard(true, false), 5000)
    return () => window.clearInterval(timer)
  }, [loadDashboard])

  const onlineDevices = data.devices.filter((device) => device.is_online)
  const latestReading = data.latestReadings[0]
  const passiveMode = data.securityState.mode === 'disarm' || data.securityState.muted
  const latestMotion = data.latestReadings.some((reading) => reading.motion_detected)
  const latestMotionReading = data.latestReadings.find((reading) => reading.motion_detected) || latestReading
  const latestMotionKey = latestMotionReading?.created_at || latestMotionReading?.recorded_at || ''

  useEffect(() => {
    if (latestMotion && latestMotionReading) setMotionAlert(latestMotionReading)
  }, [latestMotionKey])

  const updateClientControl = async (payload, message) => {
    setControlBusy(payload.mode ? 'away' : 'mute')
    setError('')
    try {
      const response = await apiPost('/iot/client-control', payload)
      setData(current => ({ ...current, securityState: response.state || current.securityState }))
      notify(message)
    } catch (requestError) {
      setError(requestError.message || 'Unable to update security controls.')
    } finally {
      setControlBusy('')
    }
  }

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

    {motionAlert && <MotionDetectionModal reading={motionAlert} securityState={data.securityState} onClose={() => setMotionAlert(null)} />}

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

    <section className="client-security-controls card neo">
      <div className="client-controls-copy"><span className="eyebrow lime">PERSONAL SECURITY CONTROLS</span><h2>{latestMotion ? 'Motion detected at your residence' : 'Your residence is being watched'}</h2><p>{latestMotion ? 'The HC-SR501 reported recent movement. Review the motion log and contact an administrator if this was unexpected.' : 'These controls apply to your connected residence hardware.'}</p></div>
      <div className="client-controls-actions">
        <button type="button" className={`security-control mute ${passiveMode ? 'active' : ''}`} onClick={() => { const nextPassive = !passiveMode; updateClientControl({ mode: nextPassive ? 'disarm' : 'away', muted: nextPassive }, nextPassive ? 'PIR sensor is now passive.' : 'Sound alerts and motion protection enabled.'); }} disabled={Boolean(controlBusy)}><Icon name={passiveMode ? 'volume-off' : 'volume'} size={19} /><span>{passiveMode ? 'Disarmed' : 'Mute sound'}</span><small>{passiveMode ? 'Buzzer is silent' : 'Put PIR into passive mode'}</small></button>
        <button type="button" className={`security-control arm ${data.securityState.mode === 'away' && !data.securityState.muted ? 'active' : ''}`} onClick={() => updateClientControl({ mode: 'away', muted: false }, 'Armed away enabled for your residence.')} disabled={Boolean(controlBusy)}><Icon name="lock" size={19} /><span>{data.securityState.mode === 'away' && !data.securityState.muted ? 'Armed away' : 'Arm away'}</span><small>{data.securityState.mode === 'away' && !data.securityState.muted ? 'Motion protection active' : 'Enable motion protection'}</small></button>
      </div>
    </section>

    <PerimeterActivity events={data.sensorEvents} loading={loading} onRefresh={() => loadDashboard(true)} />
  </>
}

function PerimeterActivity({ events, loading, onRefresh }) {
  const [range, setRange] = useState('today')
  const [view, setView] = useState('chart')
  const [expanded, setExpanded] = useState(false)
  const [logPage, setLogPage] = useState(1)
  const [showAll, setShowAll] = useState(false)
  useEffect(() => {
    setLogPage(1)
    setShowAll(false)
  }, [range])
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
  const logPageCount = Math.max(1, Math.ceil(filtered.length / 5))
  const visibleEvents = showAll ? filtered : filtered.slice((logPage - 1) * 5, logPage * 5)

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

    {loading ? <PremiumLoader label="Syncing sensor telemetry" /> : view === 'chart' ? <MotionChart points={points} /> : null}
    {!loading && <MotionList events={visibleEvents} />}
    {!loading && total > 5 && <div className="motion-pagination"><button type="button" className="secondary" onClick={() => setShowAll(value => !value)}><Icon name={showAll ? 'list' : 'grid'} size={15} />{showAll ? 'Show pages' : 'Show all'}</button><div className="motion-page-controls"><button type="button" className="icon-button" onClick={() => setLogPage(value => Math.max(1, value - 1))} disabled={showAll || logPage === 1} aria-label="Previous motion page"><Icon name="arrow-left" size={15} /></button><span>Page <strong>{showAll ? 'all' : logPage}</strong> of <strong>{showAll ? 1 : logPageCount}</strong></span><button type="button" className="icon-button" onClick={() => setLogPage(value => Math.min(logPageCount, value + 1))} disabled={showAll || logPage === logPageCount} aria-label="Next motion page"><Icon name="arrow" size={15} /></button></div></div>}
    <div className="perimeter-footer"><span><i className="legend-dot motion" />PIR Motion Triggers</span><span><i className="legend-dot verified" />AI Verified Visits</span><small>{total ? `Showing ${showAll ? total : Math.min(5, total)} of ${total} motion events` : 'No motion events in this range'}</small></div>
  </section>
}

function MotionDetectionModal({ reading, securityState, onClose }) {
  return <div className="client-motion-backdrop" role="presentation">
    <section className="client-motion-modal" role="alertdialog" aria-modal="true" aria-labelledby="motion-alert-title">
      <div className="client-motion-topline"><span className="motion-alert-pulse"><i /></span><span>LIVE PERIMETER ALERT</span><button type="button" className="client-motion-close" onClick={onClose} aria-label="Close motion alert"><Icon name="close" size={19} /></button></div>
      <div className="client-motion-mark"><Icon name="pulse" size={31} /></div>
      <span className="eyebrow lime">HC-SR501 / MOTION EVENT</span>
      <h2 id="motion-alert-title">Motion detected at your residence</h2>
      <p className="client-motion-summary">Your connected perimeter sensor reported movement. Review the event details below and take action if you do not recognize this activity.</p>
      <div className="client-motion-details"><div><small>LOCATION</small><strong>{reading.location || 'Front entrance'}</strong></div><div><small>DETECTED</small><strong>{formatTime(reading.created_at || reading.recorded_at)}</strong></div><div><small>AUDIO LEVEL</small><strong>{reading.audio_level ?? 0}</strong></div></div>
      <div className="client-motion-state"><span className="status-dot-live" />{securityState.mode === 'disarm' ? 'PIR passive mode is active' : securityState.mode === 'away' ? 'Armed away is active' : 'Security mode is active'}<span className="motion-state-divider" />{securityState.muted ? 'Sound muted' : 'Sound alerts enabled'}</div>
      <button type="button" className="primary client-motion-action" onClick={onClose}>Review motion log<Icon name="arrow" size={17} /></button>
    </section>
  </div>
}

function Metric({ label, value, detail, tone }) {
  return <div className="perimeter-metric"><span className={`metric-dot ${tone}`} /> <span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
}

function MotionChart({ points }) {
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const coordinates = points.map(point => `${point.x},${point.y}`).join(' ')
  const area = `0,100 ${coordinates} 100,100`
  return <div className="motion-chart" aria-label="Motion event chart">
    <div className="chart-y-axis"><span>10</span><span>5</span><span>0</span></div>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img"><defs><linearGradient id="motion-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#c3f56a" stopOpacity=".35" /><stop offset="1" stopColor="#c3f56a" stopOpacity="0" /></linearGradient></defs><path d={`M ${area}`} fill="url(#motion-fill)" /><polyline points={coordinates} fill="none" stroke="#c3f56a" strokeWidth=".8" vectorEffect="non-scaling-stroke" />{points.map(point => <g key={point.x} className={`motion-chart-point ${hoveredPoint?.x === point.x ? 'active' : ''}`} onPointerEnter={() => point.event && setHoveredPoint(point)} onFocus={() => point.event && setHoveredPoint(point)} onPointerLeave={() => setHoveredPoint(null)} onBlur={() => setHoveredPoint(null)} tabIndex={point.event ? 0 : -1} role={point.event ? 'button' : undefined} aria-label={point.event ? `${detectionType(point.event)} at ${formatTime(point.event.created_at || point.event.createdAt || point.event.recorded_at)}` : undefined}><circle cx={point.x} cy={point.y} r="2.6" fill="transparent" /><circle cx={point.x} cy={point.y} r={point.event ? '1.15' : '0'} fill="#efffd0" stroke="#c3f56a" strokeWidth=".55" vectorEffect="non-scaling-stroke" /></g>)}</svg>
    {hoveredPoint?.event && <div className="motion-chart-notification" style={{ left: `${hoveredPoint.x}%` }} role="status"><div className="motion-chart-notification-kicker"><span className="status-dot-live" />MOTION EVENT</div><strong>{detectionType(hoveredPoint.event)}</strong><div className="motion-chart-notification-meta"><span>{formatTime(hoveredPoint.event.created_at || hoveredPoint.event.createdAt || hoveredPoint.event.recorded_at)}</span><span>{hoveredPoint.event.location || 'Front entrance'}</span></div><small>Audio level {hoveredPoint.event.audio_level ?? 0}</small></div>}
    <div className="chart-x-axis"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>Now</span></div>
  </div>
}

function MotionList({ events }) {
  return <div className="motion-list"><div className="motion-list-heading"><span>RECENTLY SAVED MOTION</span><span>CONVEX</span></div>{events.length ? events.map((event, index) => <div className="motion-list-row" key={event.id || `${event.created_at}-${index}`}><span className="motion-event-name"><i className="legend-dot motion" />{event.title || 'PIR motion detected'} <small>{event.location || event.detail || 'Front entrance'}</small></span><time>{formatTime(event.created_at || event.createdAt)}</time></div>) : <EmptyState text="No sensor motion has been saved for this range." />}</div>
}

function dateValue(event) {
  const value = event.created_at || event.createdAt || event.recorded_at || event.recordedAt
  const timestamp = new Date(value || 0).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function chartPoints(events, range) {
  const buckets = Array.from({ length: range === 'today' ? 24 : 14 }, (_, index) => ({ value: 0, event: null, index }))
  const span = range === 'today' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
  const start = Date.now() - span
  events.forEach(event => {
    const position = Math.floor(((dateValue(event) - start) / span) * buckets.length)
    if (position >= 0 && position < buckets.length) {
      buckets[position].value += 1
      if (!buckets[position].event || dateValue(event) > dateValue(buckets[position].event)) buckets[position].event = event
    }
  })
  return buckets.map(point => ({ ...point, x: (point.index / Math.max(1, buckets.length - 1)) * 100, y: 92 - Math.min(point.value, 10) * 7 }))
}

function detectionType(event) {
  return event?.title || event?.detail || (event?.audio_detected ? 'Audio detected' : 'PIR motion detected')
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
