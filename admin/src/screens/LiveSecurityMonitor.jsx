import { Badge, Button, Icon } from '../components/ui.jsx'

function activeSeconds(state) {
  if (!state.motionSince) return 0
  return Math.max(1, Math.floor((Date.now() - state.motionSince) / 1000))
}

export default function LiveSecurityMonitor({ state, send }) {
  const detected = state.motion
  const seconds = activeSeconds(state)
  const eventTime = state.events[0]?.time || 'Pending'

  return <>
    <section className="pir-node-banner">
      <div>
        <h2><Icon name="radar" size={22} />Front Entrance Sensor Node</h2>
        <p>HC-SR501 Passive Infrared (PIR) - Optical Cadence Cross-Check</p>
        <div className="pir-chip-row">
          <span><Icon name="settings" />ESP32 DevKit v1</span>
          <span><Icon name="wifi" />HTTP QoS 1</span>
          <span><Icon name="activity" />-58 dBm</span>
          <span><Icon name="lock" />Relay Armed</span>
        </div>
      </div>
      <Badge tone={detected ? 'danger' : 'success'}>{detected ? 'MOTION DETECTED' : 'ARMED & SENSING'}</Badge>
    </section>

    <div className="pir-monitor-grid">
      <section className="pir-radar-card">
        <div className="pir-radar-head">
          <strong><Icon name="radar" />120 FIELD OF VIEW</strong>
          <span>Range: 5.0m max</span>
        </div>
        <div className={`pir-radar ${detected ? 'is-detected' : ''}`}>
          <span className="pir-sector" />
          <span className="pir-ring ring-one" />
          <span className="pir-ring ring-two" />
          <span className="pir-ring ring-three" />
          <span className="pir-axis axis-x" />
          <span className="pir-axis axis-y" />
          <span className="pir-center"><Icon name="radar" /></span>
          <span className="pir-distance d1">1.0m</span>
          <span className="pir-distance d2">3.0m</span>
          <span className="pir-distance d3">5.0m</span>
          {detected && <span className="pir-target"><span>3.2m - 94% PIR</span><Icon name="users" /></span>}
          <span className="pir-azimuth">Azimuth: +18.4 deg</span>
        </div>
      </section>

      <aside className="pir-side-panel">
        <section className="pir-status-card">
          <div className="card-heading"><h3>Motion State</h3><Icon name="users" /></div>
          <Badge tone={detected ? 'danger' : 'success'}>{detected ? 'DETECTED' : 'CLEAR'}</Badge>
          <p><Icon name="activity" /> {detected ? `Active for ${seconds}s` : 'Watching front entrance'}</p>
        </section>

        <section className="pir-status-card">
          <div className="card-heading"><h3>PIR Sensitivity</h3><Icon name="settings" /></div>
          <strong>High (3.3V)</strong>
          <p>GPIO 27 High-Level</p>
          <b>Repeat Trigger Mode</b>
        </section>

        <section className="pir-flow-card">
          <div className="card-heading"><h3>Security Event Flow</h3><span className="caption">Event #ESP-8841</span></div>
          <ol>
            <li className={detected ? 'done' : ''}><span />PIR Motion Sensor Triggered <time>{detected ? eventTime : 'Pending'}</time></li>
            <li className={detected ? 'done' : ''}><span />ESP32 HTTP Packet Published <time>{detected ? eventTime : 'Pending'}</time></li>
            <li className={detected ? 'active' : ''}><span />AI Security Voice Intercom Ready <Badge tone="info">{detected ? 'In Progress' : 'Waiting'}</Badge></li>
            <li><span />Access Verification Result <time>Pending</time></li>
          </ol>
        </section>

        <section className="pir-filter-card">
          <strong><Icon name="shield" />False Positive Rejection</strong>
          <p><span /> Optical thermal gradient algorithm active while PIR telemetry streams.</p>
        </section>

        <Button variant="primary" onClick={() => send('MOTION', { now: Date.now() })}>Test sensor</Button>
      </aside>
    </div>
  </>
}
