import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { api, clearSession, getUser, setSession, SOCKET_URL } from './api';

const realtimeEvents = [
  'device:heartbeat',
  'session:created',
  'interview:response',
  'access:denied',
  'sensor:reading',
  'motion:detected',
  'security:event',
  'alert:new',
  'alert:read',
];

const emptyDashboard = {
  devices: [],
  latestReadings: [],
  sessions: [],
  voiceInteractions: [],
  alerts: [],
  events: [],
};

function formatDate(value) {
  if (!value) return 'No timestamp';
  return new Date(value).toLocaleString();
}

function deviceName(device) {
  return device.device_name || device.name || device.device_code || `Device ${device.device_id || device.id}`;
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@cinifix.com');
  const [password, setPassword] = useState('0147');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setSession(data);
      onLogin(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <form className="login-panel" onSubmit={submit}>
        <AIIcon />
        <span className="eyebrow">SENTINEL AI / SECURE GATEWAY</span>
        <h1>Protect every threshold.</h1>
        <p>Voice-authenticated access monitoring for your connected security perimeter.</p>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required /></label>
        <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
      </form>
    </main>
  );
}

function Metric({ label, value, detail }) {
  return <article className="metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function Dashboard({ user, onLogout }) {
  const [data, setData] = useState(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [live, setLive] = useState([]);

  async function loadDashboard() {
    try {
      const response = await api.get('/dashboard');
      setData(response.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    realtimeEvents.forEach((eventName) => {
      socket.on(eventName, (payload) => {
        setLive((items) => [{ eventName, payload, at: new Date().toISOString() }, ...items].slice(0, 12));
        loadDashboard();
      });
    });
    return () => socket.disconnect();
  }, []);

  const unreadAlerts = data.alerts.filter((alert) => !alert.is_read).length;
  const onlineDevices = data.devices.filter((device) => device.is_online).length;
  const lastReading = data.latestReadings[0];
  const averageConfidence = useMemo(() => {
    const values = data.voiceInteractions.map((item) => Number(item.confidence)).filter(Number.isFinite);
    if (!values.length) return '0%';
    return `${Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)}%`;
  }, [data.voiceInteractions]);

  async function markRead(alert) {
    const id = alert.alert_id || alert.id;
    if (!id) return;
    await api.put(`/alerts/${id}/read`);
    loadDashboard();
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <AIIcon />
        <nav>
          <a href="#overview">Overview</a>
          <a href="#devices">Devices</a>
          <a href="#voice">Voice</a>
          <a href="#alerts">Alerts</a>
        </nav>
        <button onClick={() => { clearSession(); onLogout(); }}>Log out</button>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <span className="eyebrow">SMART HOME SECURITY</span>
            <h1>Live Security Dashboard</h1>
          </div>
          <div className="user-pill">{user.full_name}<small>{user.role}</small></div>
        </header>

        <div className="dashboard-layout">
        <div className="dashboard-main">
        {error && <p className="error">{error}</p>}
        {loading ? <p className="loading">Loading live security data...</p> : (
          <>
            <section className="metrics" id="overview">
              <Metric label="ESP32 Online" value={`${onlineDevices}/${data.devices.length}`} detail="Active device count" />
              <Metric label="Unread Alerts" value={unreadAlerts} detail="Needs review" />
              <Metric label="Voice Confidence" value={averageConfidence} detail="Recent average" />
              <Metric label="Latest Audio Level" value={lastReading?.audio_level ?? 0} detail="Microphone intensity" />
            </section>

            <section className="grid two">
              <Panel title="Device Status" id="devices">
                {data.devices.map((device) => (
                  <div className="row" key={device.device_id || device.id}>
                    <span className={device.is_online ? 'status online' : 'status'} />
                    <div><strong>{deviceName(device)}</strong><small>{device.location || device.device_code || 'No location'}</small></div>
                    <time>{formatDate(device.last_seen)}</time>
                  </div>
                ))}
                {!data.devices.length && <Empty text="No devices returned from PostgreSQL." />}
              </Panel>

              <Panel title="Live Sensor Readings">
                {data.latestReadings.map((reading) => (
                  <div className="sensor-card" key={reading.reading_id || reading.id || reading.device_id}>
                    <strong>Device {reading.device_id}</strong>
                    <span>Motion: {String(Boolean(reading.motion_detected))}</span>
                    <span>Audio: {String(Boolean(reading.audio_detected))}</span>
                    <span>Level: {reading.audio_level ?? 0}</span>
                  </div>
                ))}
                {!data.latestReadings.length && <Empty text="No sensor data yet." />}
              </Panel>
            </section>

            <section className="grid two">
              <Panel title="Security Sessions">
                {data.sessions.map((session) => (
                  <div className="row" key={session.session_id || session.id}>
                    <div><strong>{session.trigger_source || 'Unknown trigger'}</strong><small>{session.status || session.authorization_result || 'Pending'}</small></div>
                    <time>{formatDate(session.started_at || session.created_at)}</time>
                  </div>
                ))}
                {!data.sessions.length && <Empty text="No sessions created yet." />}
              </Panel>

              <Panel title="AI Voice Authentication" id="voice">
                {data.voiceInteractions.map((voice) => (
                  <div className="voice" key={voice.interaction_id || voice.id}>
                    <strong>{voice.evaluation_result || 'UNEVALUATED'} <span>{voice.confidence ?? 0}%</span></strong>
                    <p>{voice.recognized_text || 'No recognized speech text saved.'}</p>
                  </div>
                ))}
                {!data.voiceInteractions.length && <Empty text="No voice interactions yet." />}
              </Panel>
            </section>

            <section className="grid two">
              <Panel title="Security Alerts" id="alerts">
                {data.alerts.map((alert) => (
                  <div className={`alert ${alert.is_read ? '' : 'unread'}`} key={alert.alert_id || alert.id}>
                    <div><strong>{alert.title || alert.alert_type || 'Alert'}</strong><p>{alert.message || alert.severity || 'No message'}</p></div>
                    {!alert.is_read && <button onClick={() => markRead(alert)}>Mark read</button>}
                  </div>
                ))}
                {!data.alerts.length && <Empty text="No alerts yet." />}
              </Panel>

              <Panel title="Event Timeline">
                {data.events.map((event) => (
                  <div className="timeline-item" key={event.event_id || event.id}>
                    <span>{event.event_type}</span>
                    <p>{event.event_message || event.severity || 'Security event recorded.'}</p>
                    <time>{formatDate(event.created_at)}</time>
                  </div>
                ))}
                {!data.events.length && <Empty text="No security events yet." />}
              </Panel>
            </section>

            <Panel title="Realtime Stream">
              <div className="live-stream">
                {live.map((item) => <code key={`${item.eventName}-${item.at}`}>{item.eventName} / {formatDate(item.at)}</code>)}
                {!live.length && <Empty text="Waiting for Socket.IO updates." />}
              </div>
            </Panel>
          </>
        )}
        </div>
        <AssistantPanel />
        </div>
      </main>
    </div>
  );
}

function AIIcon() {
  return <span className="ai-icon" aria-hidden="true"><span>✦</span><i /></span>;
}

function AssistantPanel() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    { from: 'Sentinel AI', text: 'Hello. I’m Sentinel, your perimeter intelligence layer.' },
    { from: 'Sentinel AI', text: 'Ask me about device health, access events, or voice verification.' },
  ]);

  function submit(event) {
    event.preventDefault();
    const value = message.trim();
    if (!value) return;
    setMessages((items) => [...items, { from: 'You', text: value }, { from: 'Sentinel AI', text: 'I’m reviewing that against the latest security telemetry.' }]);
    setMessage('');
  }

  return <aside className="assistant-panel" aria-label="Sentinel AI assistant">
    <div className="assistant-head"><div className="assistant-identity"><AIIcon /><div><strong>Sentinel AI</strong><small>Always-on security intelligence</small></div></div><span className="online-dot">ONLINE</span></div>
    <div className="assistant-intro"><span className="assistant-kicker">AI SECURITY GUIDE</span><h2>Ask. Verify. Act.</h2><p>Make sense of live perimeter signals with a calm, conversational layer.</p></div>
    <div className="assistant-messages">{messages.map((item, index) => <div className={`assistant-message ${item.from === 'You' ? 'from-user' : ''}`} key={`${item.from}-${index}`}><span>{item.from}</span><p>{item.text}</p></div>)}</div>
    <form className="assistant-composer" onSubmit={submit}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask Sentinel AI..." aria-label="Ask Sentinel AI" /><button type="submit" aria-label="Send message">↑</button></form>
    <div className="assistant-footer"><span><i />Encrypted local session</span><span>AI CORE 4.2</span></div>
  </aside>;
}

function Panel({ title, id, children }) {
  return <section className="panel" id={id}><h2>{title}</h2>{children}</section>;
}

function Empty({ text }) {
  return <p className="empty">{text}</p>;
}

export default function App() {
  const [user, setUser] = useState(getUser());
  if (!user) return <Login onLogin={setUser} />;
  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}
