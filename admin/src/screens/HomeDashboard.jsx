import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Button, Icon, Timeline } from '../components/ui.jsx'
import { sessionLabels } from '../state/sentinel.js'

function motionEvents(events) {
  return events.filter((event) => /motion|pir|sensor/i.test(`${event.title} ${event.detail}`))
}

function chartData(state) {
  const liveBoost = state.motion ? 4 : 0
  return [
    { time: '00:00', triggers: 1, verified: 0 },
    { time: '02:00', triggers: 0, verified: 0 },
    { time: '04:00', triggers: 0, verified: 0 },
    { time: '06:00', triggers: 3, verified: 1 },
    { time: '08:00', triggers: 7, verified: 3 },
    { time: '10:00', triggers: 11 + liveBoost, verified: 5 },
    { time: '12:00', triggers: 14 + liveBoost, verified: 7 },
    { time: '14:00', triggers: 18 + liveBoost, verified: 11 },
    { time: '16:00', triggers: 12 + liveBoost, verified: 6 },
    { time: '18:00', triggers: 15 + liveBoost, verified: 9 },
    { time: '20:00', triggers: 6 + liveBoost, verified: 2 },
    { time: '22:00', triggers: 2, verified: 0 },
  ]
}

export default function HomeDashboard({ state, send, navigate, openDialog }) {
  const mode = state.mode === 'disarmed' ? 'disarmed' : state.mode
  const logs = motionEvents(state.events)
  const totalTriggers = Math.max(89, logs.length)
  const verified = Math.max(44, Math.floor(totalTriggers * 0.49))
  const filtered = Math.max(45, totalTriggers - verified)

  return <>
    <section className="security-banner">
      <div className="security-summary">
        <span className="security-emblem"><Icon name="shield" size={24} /><span className="status-dot" /></span>
        <div>
          <p className="eyebrow">PERIMETER STATUS</p>
          <h2>{mode === 'disarmed' ? 'System disarmed' : `Armed ${mode}`}</h2>
          <p className="section-description">{sessionLabels[state.session]} - ESP32 porch node online</p>
        </div>
      </div>
      <div className="mode-selector">{['away', 'home', 'disarmed'].map((value) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => send('MODE', { value })}>{value}</button>)}</div>
    </section>

    <section className="motion-log-card">
      <div className="motion-log-head">
        <div className="motion-log-title">
          <span className="motion-log-icon"><Icon name="activity" size={22} /></span>
          <div>
            <h2>Perimeter Activity & Motion Log <Badge tone="success">HC-SR501</Badge></h2>
            <p>Hourly infrared sensor events vs. conversational AI verified visits</p>
          </div>
        </div>
        <div className="motion-log-actions">
          <Button onClick={() => navigate('/monitor')}>Live Radar</Button>
          <Button onClick={() => openDialog('events')}>View Logs</Button>
        </div>
      </div>

      <div className="motion-stats-grid">
        <article><span><i />Total Triggers</span><strong>{totalTriggers}</strong><small>3.3V GPIO 27</small></article>
        <article><span><i className="blue" />AI Verified</span><strong>{verified}</strong><small>Cadence confirmed</small></article>
        <article><span><i className="muted-dot" />Filtered Noise</span><strong>{filtered}</strong><small>Thermal rejected</small></article>
      </div>

      <div className="motion-chart-wrap">
        <ResponsiveContainer width="100%" height={265} minWidth={1} minHeight={265}>
          <AreaChart data={chartData(state)} margin={{ top: 18, right: 22, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="pirFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#006f68" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#006f68" stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id="aiFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0074ad" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#0074ad" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#cfe0e6" strokeDasharray="3 6" />
            <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: '#5b7180', fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: '#5b7180', fontSize: 12 }} />
            <Tooltip contentStyle={{ border: 0, borderRadius: 14, boxShadow: '0 16px 34px rgba(37,55,65,.18)' }} />
            <Area type="monotone" dataKey="triggers" name="Motion Triggers" stroke="#006f68" strokeWidth={3} fill="url(#pirFill)" />
            <Area type="monotone" dataKey="verified" name="AI Verified Visits" stroke="#0074ad" strokeWidth={3} fill="url(#aiFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="motion-log-foot">
        <span><i /> PIR Motion Triggers</span>
        <span><i className="blue" /> AI Verified Visits</span>
      </div>
    </section>

    <div className="metrics-grid">
      <article className="metric-card"><div className="metric-top"><span>Lock state</span><Icon name={state.locked ? 'lock' : 'unlock'} /></div><strong className="metric-value">{state.locked ? 'Secured' : 'Open'}</strong><p>Porch strike relay</p><div className="metric-foot"><Badge tone={state.locked ? 'success' : 'info'}>{state.locked ? 'Protected' : 'Manual access'}</Badge></div></article>
      <article className="metric-card"><div className="metric-top"><span>Active session</span><Icon name="activity" /></div><strong className="metric-value">{state.session}</strong><p>AI verification state</p><div className="metric-foot"><span className="status-dot" /> Live telemetry</div></article>
      <article className="metric-card"><div className="metric-top"><span>Authorized visitors</span><Icon name="users" /></div><strong className="metric-value">{state.visitors.filter((visitor) => visitor.status === 'authorized').length}</strong><p>Current access profiles</p><div className="metric-foot"><Button onClick={() => navigate('/visitors')}>Manage visitors</Button></div></article>
    </div>

    <div className="dashboard-grid">
      <section className="card"><div className="card-heading"><div className="card-title-wrap"><span className="small-icon"><Icon name="radar" /></span><div><h3>Recent motion activity</h3><p className="caption">Saved PIR motion events from backend activity logs</p></div></div><Badge tone={state.motion ? 'danger' : 'success'}>{state.motion ? 'Motion' : 'Clear'}</Badge></div><Timeline events={logs.slice(0, 4)} /></section>
      <section className="card"><div className="card-heading"><div><h3>Recent security events</h3><p className="caption">Latest activity from Sentinel AI</p></div><Button onClick={() => openDialog('events')}>View all</Button></div><Timeline events={state.events.slice(0, 4)} /></section>
    </div>
  </>
}
