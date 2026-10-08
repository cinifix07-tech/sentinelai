import React, { useState, useEffect } from 'react';
import { AppTab } from '../../types';
import { apiGet } from '../../api.js';

interface MonitorScreenProps {
  onNavigate: (tab: AppTab) => void;
}

export const MonitorScreen: React.FC<MonitorScreenProps> = ({ onNavigate }) => {
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [motionDetected, setMotionDetected] = useState(false);
  const [deviceOnline, setDeviceOnline] = useState(false);
  const [readings, setReadings] = useState<Record<string, unknown>[]>([]);
  const [readingsPage, setReadingsPage] = useState(1);
  const [readingsTotal, setReadingsTotal] = useState(0);
  const [readingsTotalPages, setReadingsTotalPages] = useState(1);
  const [securityMode, setSecurityMode] = useState<'away' | 'home' | 'disarm'>('away');
  const [targetClicked, setTargetClicked] = useState(false);

  useEffect(() => {
    let active = true;
    const loadTelemetry = async () => {
      try {
        const [latest, activity] = await Promise.all([
          apiGet('/iot/latest?device_code=esp32-porch-01'),
          apiGet('/iot/activity?limit=1'),
        ]);
        if (!active) return;
        const reading = latest?.reading;
        const readingDate = reading?.created_at ? new Date(reading.created_at) : null;
        const readingAge = readingDate ? Date.now() - readingDate.getTime() : Infinity;
        const latestMotionEvent = Array.isArray(activity?.events) ? activity.events[0] : null;
        const eventDate = latestMotionEvent?.created_at ? new Date(latestMotionEvent.created_at) : null;
        const eventAge = eventDate ? Date.now() - eventDate.getTime() : Infinity;
        const recentReadingMotion = Boolean(reading?.motion_detected) && readingAge >= 0 && readingAge < 15000;
        const recentActivityMotion = Boolean(latestMotionEvent) && eventAge >= 0 && eventAge < 15000;
        const recentMotion = recentReadingMotion || recentActivityMotion;
        setMotionDetected(recentMotion);
        setActiveSeconds(recentMotion && readingDate ? Math.max(1, Math.floor(readingAge / 1000)) : 0);
        const lastSeen = latest?.device?.last_seen ? new Date(latest.device.last_seen).getTime() : 0;
        setDeviceOnline(Boolean(latest?.device?.is_online) && Date.now() - lastSeen < 30000);
        if (['away', 'home', 'disarm'].includes(latest?.state?.mode)) setSecurityMode(latest.state.mode);
      } catch {
        if (active) setDeviceOnline(false);
      }
    };
    loadTelemetry();
    const timer = window.setInterval(loadTelemetry, 2000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadReadings = async () => {
      try {
        const response = await apiGet(`/sensors/readings?device_id=esp32-porch-01&page=${readingsPage}`);
        if (!active) return;
        setReadings(Array.isArray(response?.readings) ? response.readings : []);
        setReadingsTotal(Number(response?.total || 0));
        setReadingsTotalPages(Math.max(1, Number(response?.total_pages || 1)));
        if (Number(response?.page || readingsPage) !== readingsPage) {
          setReadingsPage(Number(response?.page || 1));
        }
      } catch {
        if (active) setReadings([]);
      }
    };

    loadReadings();
    const timer = window.setInterval(loadReadings, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [readingsPage]);

  const handleTargetClick = () => {
    setTargetClicked(true);
    setTimeout(() => setTargetClicked(false), 800);
  };

  const formatReadingTime = (value: unknown) => {
    if (!value) return '—';
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString([], {
      month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  const readingStatus = (value: unknown) => Boolean(value) ? 'Detected' : 'Clear';

  return (
    <div className="flex flex-col w-full gap-5 max-w-7xl mx-auto pb-24">
      {/* Node Status Header Card */}
      <div className="flex flex-col bg-surface-container-lowest p-4 sm:p-5 rounded-xl shadow-sm gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[20px]">door_front</span>
              <h1 className="font-display font-semibold text-lg text-on-surface truncate">
                Front Entrance Sensor Node
              </h1>
            </div>
            <span className="text-[12px] text-on-surface-variant mt-0.5">
              HC-SR501 Passive Infrared (PIR) • Optical Cadence Cross-Check
            </span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed shrink-0 shadow-sm self-start sm:self-auto">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-[11px] font-bold tracking-wide">
              {deviceOnline ? `${securityMode === 'disarm' ? 'PASSIVE' : 'ARMED'} & SENSING` : 'DEVICE OFFLINE'}
            </span>
          </div>
        </div>

        {/* Micro Hardware Chips */}
        <div className="flex items-center gap-2 pt-1 overflow-x-auto">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container-low text-on-surface-variant text-[11px] font-medium shrink-0">
            <span className="material-symbols-outlined text-[15px] text-secondary">memory</span>
            <span>ESP32 DevKit v1</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container-low text-on-surface-variant text-[11px] font-medium shrink-0">
            <span className="material-symbols-outlined text-[15px] text-secondary">swap_calls</span>
            <span>MQTT QoS 1</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container-low text-on-surface-variant text-[11px] font-medium shrink-0">
            <span className="material-symbols-outlined text-[15px] text-primary">wifi</span>
            <span>-58 dBm</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container-low text-on-surface-variant text-[11px] font-medium shrink-0">
            <span className="material-symbols-outlined text-[15px] text-[#0f766e]">lock_clock</span>
            <span>Relay Armed</span>
          </div>
        </div>
      </div>

      {/* Main Responsive Grid: Radar on Left, Telemetry & Stepper on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 cols): Radar Visualization & Actions */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Soft Precision Radar Visualization */}
          <div className="flex flex-col items-center justify-center bg-surface-container-lowest p-5 sm:p-6 rounded-xl shadow-sm relative overflow-hidden">
            {/* Top Bar Labels */}
            <div className="w-full flex items-center justify-between z-10 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary text-[18px]">explore</span>
                <span className="text-[11px] font-semibold text-on-surface-variant tracking-wider">
                  120° FIELD OF VIEW
                </span>
              </div>
              <span className="font-mono text-[12px] text-primary font-bold">Range: 5.0m max</span>
            </div>

            {/* Radar Disc Canvas Container */}
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-full bg-surface-container-low flex items-center justify-center shadow-inner overflow-hidden my-3 border border-surface-container">
              {/* Concentric Range Rings */}
              <div className="absolute w-[88%] h-[88%] rounded-full bg-surface-container-lowest/60 flex items-center justify-center border border-outline-variant/30">
                <span className="absolute top-1 text-[10px] font-mono text-outline">5.0m</span>
              </div>
              <div className="absolute w-[60%] h-[60%] rounded-full bg-surface-container/50 flex items-center justify-center border border-outline-variant/30">
                <span className="absolute top-1 text-[10px] font-mono text-outline">3.0m</span>
              </div>
              <div className="absolute w-[32%] h-[32%] rounded-full bg-surface-container-high/40 flex items-center justify-center border border-outline-variant/30">
                <span className="absolute top-1 text-[10px] font-mono text-outline">1.0m</span>
              </div>

              {/* Angular Crosshair Axis Lines */}
              <div className="absolute w-full h-[1px] bg-outline-variant/30" />
              <div className="absolute h-full w-[1px] bg-outline-variant/30" />
              <div className="absolute w-full h-[1px] bg-outline-variant/20 rotate-45" />
              <div className="absolute w-full h-[1px] bg-outline-variant/20 -rotate-45" />

              {/* Smooth Radar Sweep Cone */}
              <div
                className="absolute inset-0 rounded-full animate-[spin_4s_linear_infinite]"
                style={{
                  background:
                    'conic-gradient(from 0deg at 50% 50%, rgba(91, 184, 254, 0) 0deg, rgba(91, 184, 254, 0.02) 270deg, rgba(15, 118, 110, 0.28) 360deg)',
                }}
              />

              {/* PIR only reports motion presence; distance and direction are unavailable. */}
              {motionDetected && <div
                id="targetNode"
                onClick={handleTargetClick}
                className={`absolute top-[28%] right-[32%] z-20 flex items-center justify-center cursor-pointer transition-transform ${
                  targetClicked ? 'scale-125' : 'hover:scale-110'
                }`}
              >
                <span className="animate-ping absolute inline-flex h-9 w-9 rounded-full bg-primary-fixed-dim opacity-75" />
                <span className="relative inline-flex items-center justify-center rounded-full h-6 w-6 bg-primary text-on-primary shadow-md">
                  <span className="material-symbols-outlined text-[14px]">person</span>
                </span>

                {/* Floating Distance & Confidence Tag */}
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-full bg-inverse-surface text-inverse-on-surface text-[10px] font-semibold shadow-sm flex items-center gap-1">
                  <span>PIR ACTIVE</span>
                  <span className="w-1 h-1 rounded-full bg-secondary-container" />
                  <span>LIVE</span>
                </div>
              </div>}

              {/* Center Sensor Anchor (ESP32 node location) */}
              <div className="relative z-20 flex flex-col items-center justify-center w-11 h-11 rounded-full bg-surface-container-lowest text-primary shadow-md">
                <span className="material-symbols-outlined text-[22px]">sensor_occupied</span>
              </div>

              {/* Live Angular Cone Mask Indicator */}
              <div className="absolute bottom-3 font-mono text-[10px] text-on-surface-variant bg-surface-container-lowest/90 px-2.5 py-0.5 rounded-full shadow-xs">
                {motionDetected ? 'PIR signal detected - direction unavailable' : 'Scanning for PIR signal'}
              </div>
            </div>

          </div>

          {/* Primary Interactive Control Area */}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => onNavigate('voice')}
              className="w-full min-h-[48px] py-3 px-4 bg-primary text-on-primary rounded-xl shadow-sm flex items-center justify-center gap-2 hover:bg-primary-container transition-all active:scale-[0.99]"
            >
              <span className="material-symbols-outlined text-[22px]">record_voice_over</span>
              <span className="font-display font-semibold text-sm">Launch AI Assistant Intercom</span>
            </button>

          </div>
        </div>

        {/* Right Column (5 cols): Live Sensor Telemetry */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Real-time Telemetry Bento Grid */}
          <div className="grid grid-cols-1 gap-3">
            {/* Motion State Card */}
            <div className="flex flex-col justify-between bg-surface-container-lowest p-3.5 rounded-xl shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-on-surface-variant">MOTION STATE</span>
                <span className="material-symbols-outlined text-secondary text-[18px]">directions_walk</span>
              </div>
              <div className="my-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${motionDetected ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-surface-container text-on-surface-variant'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${motionDetected ? 'bg-secondary' : 'bg-outline'}`} />
                  {motionDetected ? 'DETECTED' : 'CLEAR'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-on-surface-variant">
                <span className="material-symbols-outlined text-[14px]">timer</span>
                <span className="font-mono text-xs">Active for {activeSeconds}s</span>
              </div>
            </div>

          </div>

        </div>
      </div>

      <section className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden w-full mt-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-outline-variant/35">
          <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary-fixed flex items-center justify-center text-primary shadow-sm">
              <span className="material-symbols-outlined text-[19px]">database</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display font-semibold text-base text-on-surface">Sensor readings</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2 py-1 text-[10px] font-bold tracking-wide text-on-surface-variant">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" /> LIVE
                </span>
              </div>
              <p className="text-[10px] text-on-surface-variant mt-0.5">PostgreSQL telemetry · 5 per page</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-on-surface-variant shrink-0">
            <span className="material-symbols-outlined text-[16px] text-primary">table_rows</span>
            {readingsTotal} total records
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead className="bg-surface-container-low text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
              <tr>
                <th className="px-4 py-2.5 font-bold">Recorded</th>
                <th className="px-3 py-2.5 font-bold">Device</th>
                <th className="px-3 py-2.5 font-bold">Motion</th>
                <th className="px-3 py-2.5 font-bold">Audio</th>
                <th className="px-3 py-2.5 font-bold">Level</th>
                <th className="px-4 py-2.5 text-right font-bold">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/25">
              {readings.length ? readings.map((reading, index) => (
                <tr key={String(reading.reading_id || `${reading.recorded_at}-${index}`)} className="hover:bg-surface-container-low/70 transition-colors">
                  <td className="px-4 py-3 text-[11px] font-medium text-on-surface whitespace-nowrap">{formatReadingTime(reading.recorded_at || reading.created_at)}</td>
                  <td className="px-3 py-3 text-[10px] text-on-surface-variant">{String(reading.device_code || reading.device_id || 'esp32-porch-01')}</td>
                  <td className="px-3 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${reading.motion_detected ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-surface-container text-on-surface-variant'}`}><span className={`h-1.5 w-1.5 rounded-full ${reading.motion_detected ? 'bg-secondary' : 'bg-outline'}`} />{readingStatus(reading.motion_detected)}</span></td>
                  <td className="px-3 py-3 text-[10px] text-on-surface-variant">{readingStatus(reading.audio_detected)}</td>
                  <td className="px-3 py-3 text-[10px] font-mono text-on-surface-variant">{reading.audio_level == null ? '—' : String(reading.audio_level)}</td>
                  <td className="px-4 py-3 text-right text-[10px] font-mono text-outline">#{String(reading.reading_id || '—')}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-5 py-8 text-center"><span className="material-symbols-outlined text-[24px] text-outline">sensors_off</span><p className="mt-1 text-xs font-medium text-on-surface-variant">No sensor readings saved yet</p><p className="mt-1 text-[10px] text-outline">Live HC-SR501 data will appear automatically.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-2.5 border-t border-outline-variant/35 bg-surface-container-low/45">
          <span className="text-[11px] text-on-surface-variant">Page <strong className="text-on-surface">{readingsPage}</strong> of <strong className="text-on-surface">{readingsTotalPages}</strong></span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setReadingsPage((page) => Math.max(1, page - 1))} disabled={readingsPage <= 1} className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-surface-container px-3 text-[11px] font-semibold text-on-surface shadow-sm transition hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40"><span className="material-symbols-outlined text-[15px]">chevron_left</span>Previous</button>
            <button type="button" onClick={() => setReadingsPage((page) => Math.min(readingsTotalPages, page + 1))} disabled={readingsPage >= readingsTotalPages} className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-primary px-3 text-[11px] font-semibold text-on-primary shadow-sm transition hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-40">Next<span className="material-symbols-outlined text-[15px]">chevron_right</span></button>
          </div>
        </div>
      </section>

    </div>
  );
};
