import React, { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../api.js';
import { PremiumLoader } from '../PremiumUI';

interface AccessAttempt {
  attempt_id?: number | string;
  id?: number | string;
  session_id?: number | string;
  device_id?: number | string;
  user_id?: number | string;
  attempt_number?: number;
  result?: string;
  reason?: string;
  created_at?: string;
  attempt_time?: string;
}

const LOG_PAGE_SIZES = [5, 10, 15];

function formatLogTime(value?: string) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resultTone(result?: string) {
  const normalized = String(result || '').toUpperCase();
  if (normalized.includes('FAILED') || normalized === 'DENIED' || normalized === 'REJECTED') return 'bg-error-container text-on-error-container';
  if (normalized.includes('LOGIN') || normalized.includes('UPDATED') || normalized.includes('CHANGED') || normalized === 'GRANTED' || normalized === 'ALLOWED' || normalized === 'AUTHORIZED') return 'bg-primary-fixed text-on-primary-fixed-variant';
  return 'bg-surface-container text-on-surface-variant';
}

function activityIcon(result?: string) {
  const normalized = String(result || '').toUpperCase();
  if (normalized.includes('FAILED') || normalized === 'DENIED') return 'block';
  if (normalized.includes('LOGIN')) return 'login';
  if (normalized.includes('PASSWORD') || normalized.includes('OTP')) return 'lock_reset';
  if (normalized.includes('NAME') || normalized.includes('PROFILE') || normalized.includes('USER')) return 'manage_accounts';
  if (normalized.includes('PREFERENCE')) return 'tune';
  if (normalized.includes('LOGOUT')) return 'logout';
  return 'verified_user';
}

export const SettingsScreen: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [otaChecking, setOtaChecking] = useState(false);
  const [otaStatus, setOtaStatus] = useState<string | null>(null);
  const [runningDiagnostic, setRunningDiagnostic] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<string | null>(null);

  const [aiVoicePersona, setAiVoicePersona] = useState('Serene Guardian (Neutral, Crisp)');
  const [confidenceThreshold, setConfidenceThreshold] = useState(92);
  const [recordAudioClips, setRecordAudioClips] = useState(true);
  const [chimeVolume, setChimeVolume] = useState(75);
  const [strikeHoldSeconds, setStrikeHoldSeconds] = useState(8);
  const [accessAttempts, setAccessAttempts] = useState<AccessAttempt[]>([]);
  const [accessLogLoading, setAccessLogLoading] = useState(true);
  const [accessLogError, setAccessLogError] = useState('');
  const [expandedAttempt, setExpandedAttempt] = useState<string | null>(null);
  const [accessResultFilter, setAccessResultFilter] = useState('ALL');
  const [accessLogPage, setAccessLogPage] = useState(1);
  const [accessLogPageSize, setAccessLogPageSize] = useState(5);

  async function loadAccessAttempts() {
    setAccessLogLoading(true);
    setAccessLogError('');
    try {
      setAccessAttempts(await apiGet('/access/attempts'));
    } catch (error) {
      setAccessLogError(error instanceof Error ? error.message : 'Unable to load access attempts.');
    } finally {
      setAccessLogLoading(false);
    }
  }

  useEffect(() => {
    loadAccessAttempts();
  }, []);

  useEffect(() => {
    setAccessLogPage(1);
  }, [accessResultFilter, accessLogPageSize]);

  const accessResults = useMemo(() => {
    return Array.from(new Set(accessAttempts.map((attempt) => String(attempt.result || 'UNKNOWN').toUpperCase())));
  }, [accessAttempts]);

  const filteredAccessAttempts = useMemo(() => {
    if (accessResultFilter === 'ALL') return accessAttempts;
    return accessAttempts.filter((attempt) => String(attempt.result || 'UNKNOWN').toUpperCase() === accessResultFilter);
  }, [accessAttempts, accessResultFilter]);

  const accessLogPageCount = Math.max(1, Math.ceil(filteredAccessAttempts.length / accessLogPageSize));
  const currentAccessLogPage = Math.min(accessLogPage, accessLogPageCount);
  const visibleAccessAttempts = filteredAccessAttempts.slice(
    (currentAccessLogPage - 1) * accessLogPageSize,
    currentAccessLogPage * accessLogPageSize
  );
  const accessLogStart = filteredAccessAttempts.length ? (currentAccessLogPage - 1) * accessLogPageSize + 1 : 0;
  const accessLogEnd = Math.min(currentAccessLogPage * accessLogPageSize, filteredAccessAttempts.length);

  const handleCheckOta = () => {
    setOtaChecking(true);
    setOtaStatus(null);
    setTimeout(() => {
      setOtaChecking(false);
      setOtaStatus('Firmware v1.0.0 is up to date. Hash #8f32a0d confirmed.');
    }, 1200);
  };

  const handleRunDiagnostic = () => {
    setRunningDiagnostic(true);
    setDiagnosticResult(null);
    setTimeout(() => {
      setRunningDiagnostic(false);
      setDiagnosticResult('All hardware channels passed. PIR GPIO 14: 3.3V logic high, I2S microphone SNR: 68dB, MQTT latency: 12ms.');
    }, 1800);
  };

  return (
    <div className="flex flex-col w-full gap-5 max-w-7xl mx-auto pb-24">
      <button onClick={onLogout} className="self-end px-5 py-2.5 rounded-xl bg-red-50 text-red-700 font-semibold hover:bg-red-100">Log out</button>
      {/* Top Header Card */}
      <section className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 shadow-sm flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[24px]">tune</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-lg sm:text-xl text-on-surface">
                System &amp; ESP32 Architecture Settings
              </h1>
              <span className="text-[12px] text-on-surface-variant">
                Node controller firmware, pinout GPIO routing &amp; audio AI models
              </span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-primary-fixed text-primary text-xs font-bold shadow-xs">
            Online &amp; Armed
          </span>
        </div>
      </section>

      <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container/60 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-surface-container flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[23px]">history</span>
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-base text-on-surface">Admin &amp; User Activity Log</h2>
              <p className="text-[12px] text-on-surface-variant">Latest 15 records from access_attempts. Older data is permanently deleted, not archived.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <label className="flex items-center gap-2 text-xs text-on-surface-variant">
              Result
              <select
                value={accessResultFilter}
                onChange={(event) => setAccessResultFilter(event.target.value)}
                className="h-10 rounded-xl bg-surface-container px-3 text-xs text-on-surface outline-none"
              >
                <option value="ALL">All</option>
                {accessResults.map((result) => (
                  <option key={result} value={result}>{result}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={loadAccessAttempts}
              className="h-10 px-4 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors flex items-center justify-center gap-1.5 shadow-xs"
            >
              <span className="material-symbols-outlined text-[17px]">sync</span>
              Refresh
            </button>
          </div>
        </div>

        <div className="divide-y divide-surface-container">
          {accessLogLoading && (
            <div className="px-5 py-8"><PremiumLoader label="Loading activity records" /></div>
          )}

          {!accessLogLoading && accessLogError && (
            <div className="px-5 py-10 text-center text-sm text-[#ba1a1a]">{accessLogError}</div>
          )}

          {!accessLogLoading && !accessLogError && visibleAccessAttempts.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-on-surface-variant">No activity records match this filter.</div>
          )}

          {!accessLogLoading && !accessLogError && visibleAccessAttempts.map((attempt, index) => {
            const attemptKey = String(attempt.attempt_id || attempt.id || `${attempt.session_id}-${attempt.attempt_number}-${index}`);
            const expanded = expandedAttempt === attemptKey;
            const result = String(attempt.result || 'UNKNOWN').toUpperCase();
            return (
              <article key={attemptKey} className="bg-surface-container-lowest">
                <button
                  type="button"
                  onClick={() => setExpandedAttempt(expanded ? null : attemptKey)}
                  className="w-full p-4 sm:p-5 text-left hover:bg-surface-container-low transition-colors"
                  aria-expanded={expanded}
                >
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 md:items-center">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-10 h-10 rounded-full grid place-items-center shrink-0 ${resultTone(result)}`}>
                        <span className="material-symbols-outlined text-[20px]">
                          {activityIcon(result)}
                        </span>
                      </span>
                      <div className="min-w-0">
                        <p className="font-display font-semibold text-sm text-on-surface truncate">
                          {result.replaceAll('_', ' ')}
                        </p>
                        <p className="text-[11px] text-on-surface-variant truncate">
                          {attempt.reason || 'No reason recorded'}
                        </p>
                      </div>
                    </div>
                    <span className={`justify-self-start md:justify-self-end inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${resultTone(result)}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {result}
                    </span>
                    <div className="flex items-center gap-2 justify-between md:justify-end">
                      <span className="font-mono text-[11px] text-on-surface-variant">{formatLogTime(attempt.created_at || attempt.attempt_time)}</span>
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                        {expanded ? 'expand_less' : 'expand_more'}
                      </span>
                    </div>
                  </div>
                </button>

                {expanded && (
                  <div className="px-4 sm:px-5 pb-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl bg-surface-container-low p-3 text-xs">
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide text-on-surface-variant font-bold">Record</span>
                        <span className="font-mono text-on-surface">{attempt.attempt_id || attempt.id || attempt.attempt_number || 'Live'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide text-on-surface-variant font-bold">Session / Device</span>
                        <span className="font-mono text-on-surface">{attempt.session_id || attempt.device_id || 'None'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide text-on-surface-variant font-bold">User</span>
                        <span className="text-on-surface">
                          {attempt.user_name || attempt.user_email || attempt.user_id || 'Unknown'}
                          {attempt.user_email && attempt.user_name ? <small className="ml-2 text-on-surface-variant">{attempt.user_email}</small> : null}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className="p-4 sm:p-5 border-t border-surface-container flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between bg-surface-container-lowest">
          <p className="text-xs text-on-surface-variant">
            Showing <span className="font-semibold text-on-surface">{accessLogStart}</span>-<span className="font-semibold text-on-surface">{accessLogEnd}</span> of <span className="font-semibold text-on-surface">{filteredAccessAttempts.length}</span> activities. Limit: latest 15 only.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-on-surface-variant">
              Rows
              <select
                value={accessLogPageSize}
                onChange={(event) => setAccessLogPageSize(Number(event.target.value))}
                className="h-9 rounded-lg bg-surface-container px-2 text-xs text-on-surface outline-none"
              >
                {LOG_PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setAccessLogPage((value) => Math.max(1, value - 1))}
              disabled={currentAccessLogPage === 1}
              className="h-9 px-3 rounded-lg bg-surface-container text-xs font-semibold text-on-surface disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-container-high"
            >
              Previous
            </button>
            <span className="h-9 px-3 rounded-lg bg-primary text-on-primary text-xs font-semibold grid place-items-center">
              {currentAccessLogPage} / {accessLogPageCount}
            </span>
            <button
              type="button"
              onClick={() => setAccessLogPage((value) => Math.min(accessLogPageCount, value + 1))}
              disabled={currentAccessLogPage === accessLogPageCount}
              className="h-9 px-3 rounded-lg bg-surface-container text-xs font-semibold text-on-surface disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-container-high"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {false && <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 cols on lg screens): Hardware Node & Pinout & Network */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Hardware Node Card */}
          <section className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 shadow-sm flex flex-col space-y-4 border border-surface-container/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[22px]">memory</span>
                <span className="font-display font-semibold text-sm text-on-surface">
                  ESP32 DevKit v1 Core Sentinel Node
                </span>
              </div>
              <span className="font-mono text-xs text-primary font-bold">v1.0.0 Stable</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-surface-container-low rounded-xl flex flex-col justify-between">
                <span className="text-[11px] text-on-surface-variant">IP &amp; Hardware MAC</span>
                <span className="font-mono font-semibold text-xs text-on-surface mt-1">192.168.1.184</span>
                <span className="font-mono text-[10px] text-outline mt-0.5">24:6F:28:9B:30:1E</span>
              </div>
              <div className="p-3 bg-surface-container-low rounded-xl flex flex-col justify-between">
                <span className="text-[11px] text-on-surface-variant">Memory Heap &amp; Flash</span>
                <span className="font-mono font-semibold text-xs text-primary mt-1">142 KB / 320 KB Free</span>
                <span className="text-[10px] text-outline mt-0.5">Flash: 4MB QIO 80MHz</span>
              </div>
            </div>

            {/* Pinout Mapping Micro Table */}
            <div className="p-3.5 bg-surface-container-low rounded-xl space-y-2 text-xs">
              <span className="font-bold text-on-surface block text-[11px] uppercase tracking-wide">
                Hardware GPIO Pin Assignments:
              </span>
              <div className="flex items-center justify-between text-on-surface-variant">
                <span>HC-SR501 PIR Trigger:</span>
                <span className="font-mono font-semibold text-primary">GPIO 14 (Input Pull-Down)</span>
              </div>
              <div className="flex items-center justify-between text-on-surface-variant">
                <span>Front Door Electronic Strike:</span>
                <span className="font-mono font-semibold text-secondary">GPIO 27 (Relay Out 5V)</span>
              </div>
              <div className="flex items-center justify-between text-on-surface-variant">
                <span>I2S Intercom Mic &amp; Amp:</span>
                <span className="font-mono font-semibold text-tertiary">GPIO 25, 26, 33 (I2S Bus)</span>
              </div>
              <div className="flex items-center justify-between text-on-surface-variant">
                <span>Status RGB NeoPixel LED:</span>
                <span className="font-mono font-semibold text-on-surface">GPIO 18 (FastLED Data)</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                onClick={handleCheckOta}
                disabled={otaChecking}
                className="px-3.5 py-2.5 bg-surface-container rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">system_update_alt</span>
                <span>{otaChecking ? 'Checking GitHub Releases...' : 'Check for OTA Update'}</span>
              </button>
              <button
                onClick={handleRunDiagnostic}
                disabled={runningDiagnostic}
                className="px-4 py-2.5 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary-container transition-colors shadow-xs flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">build_circle</span>
                <span>{runningDiagnostic ? 'Testing Node...' : 'Run Self-Test'}</span>
              </button>
            </div>

            {otaStatus && (
              <div className="p-3 rounded-xl bg-surface-container-low text-xs text-primary font-medium border border-primary/20 animate-in fade-in">
                {otaStatus}
              </div>
            )}

            {diagnosticResult && (
              <div className="p-3 rounded-xl bg-[#eff4ff] text-xs text-secondary font-medium border border-secondary/20 animate-in fade-in">
                ✓ {diagnosticResult}
              </div>
            )}
          </section>

          {/* Network & MQTT Broker Config */}
          <section className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 shadow-sm flex flex-col space-y-3 border border-surface-container/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">hub</span>
                <span className="font-display font-semibold text-xs text-on-surface uppercase tracking-wide">
                  Network &amp; MQTT Telemetry
                </span>
              </div>
              <span className="px-2.5 py-0.5 bg-primary-fixed text-primary rounded-full text-[11px] font-bold">
                TLS 1.3 mTLS
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-surface-container-low rounded-xl flex items-center justify-between">
                <span className="text-on-surface-variant">Broker Host:</span>
                <span className="font-mono font-semibold text-on-surface">broker.sentinel-security.local</span>
              </div>
              <div className="p-2.5 bg-surface-container-low rounded-xl flex items-center justify-between">
                <span className="text-on-surface-variant">TLS Port:</span>
                <span className="font-mono font-semibold text-on-surface">8883 (Cert Auth Active)</span>
              </div>
              <div className="p-2.5 bg-surface-container-low rounded-xl flex items-center justify-between">
                <span className="text-on-surface-variant">QoS Level:</span>
                <span className="font-mono font-semibold text-primary">At least once (QoS 1)</span>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column (5 cols on lg screens): AI Voice Parameters & Strike Timing */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* AI Voice Assistant Configuration */}
          <section className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 shadow-sm flex flex-col space-y-4 border border-surface-container/60">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">smart_toy</span>
              <span className="font-display font-semibold text-sm text-on-surface">
                AI Voice Guard Parameters
              </span>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-on-surface-variant mb-1.5 block">
                  Synthesized Voice Persona
                </label>
                <select
                  value={aiVoicePersona}
                  onChange={(e) => setAiVoicePersona(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-surface-container-low text-xs border border-surface-container text-on-surface focus:outline-none focus:border-primary"
                >
                  <option>Serene Guardian (Neutral, Crisp)</option>
                  <option>Concierge Professional (Polite, Formal)</option>
                  <option>Casual Neighbor (Friendly, Conversational)</option>
                  <option>High Authority Security (Firm, Direct)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-on-surface-variant mb-1">
                  <span>Confidence Threshold</span>
                  <span className="font-mono text-primary font-bold">{confidenceThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="70"
                  max="99"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-on-surface-variant mb-1">
                  <span>Porch Speaker Chime Volume</span>
                  <span className="font-mono text-primary font-bold">{chimeVolume}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={chimeVolume}
                  onChange={(e) => setChimeVolume(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-on-surface-variant mb-1">
                  <span>Strike Latch Unlock Duration</span>
                  <span className="font-mono text-primary font-bold">{strikeHoldSeconds}s</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="20"
                  value={strikeHoldSeconds}
                  onChange={(e) => setStrikeHoldSeconds(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              <label className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl cursor-pointer">
                <span className="text-xs text-on-surface font-medium">
                  Archive Voice Utterances to Cloud
                </span>
                <input
                  type="checkbox"
                  checked={recordAudioClips}
                  onChange={(e) => setRecordAudioClips(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-surface-variant rounded-full peer peer-checked:bg-primary relative transition-colors">
                  <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 left-0.5 peer-checked:translate-x-5 transition-transform" />
                </div>
              </label>
            </div>
          </section>

          {/* System Security Policies */}
          <section className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 shadow-sm flex flex-col space-y-3 border border-surface-container/60">
            <span className="font-display font-semibold text-xs text-on-surface uppercase tracking-wide">
              Automated Fail-Safe Policies
            </span>
            <div className="space-y-2 text-xs text-on-surface-variant leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5">
                  check
                </span>
                <span>Power Outage: Fail-secure lock latch remains mechanically engaged.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5">
                  check
                </span>
                <span>Tamper Switch: Disconnection triggers immediate siren alert and SMS.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5">
                  check
                </span>
                <span>Rate Limiting: Max 3 visitor verification attempts per 10 minutes.</span>
              </div>
            </div>
          </section>
        </div>
      </div>}
    </div>
  );
};
