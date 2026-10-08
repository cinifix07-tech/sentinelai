import React, { useState, useEffect } from 'react';
import { AppTab } from '../../types';
import { BRAND_ASSETS } from '../../mockData';

interface MonitorScreenProps {
  onNavigate: (tab: AppTab) => void;
}

export const MonitorScreen: React.FC<MonitorScreenProps> = ({ onNavigate }) => {
  const [activeSeconds, setActiveSeconds] = useState(18);
  const [isChimeMuted, setIsChimeMuted] = useState(false);
  const [muteSecondsLeft, setMuteSecondsLeft] = useState(300);
  const [sensitivityModalOpen, setSensitivityModalOpen] = useState(false);
  const [sensitivityLevel, setSensitivityLevel] = useState<'Low' | 'Medium' | 'High'>('High');
  const [targetClicked, setTargetClicked] = useState(false);

  // Motion active counter simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSeconds((prev) => (prev >= 99 ? 1 : prev + 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Chime countdown simulation
  useEffect(() => {
    if (!isChimeMuted) return;
    const timer = setInterval(() => {
      setMuteSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsChimeMuted(false);
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isChimeMuted]);

  const formatMuteTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleTargetClick = () => {
    setTargetClicked(true);
    setTimeout(() => setTargetClicked(false), 800);
  };

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
            <span className="text-[11px] font-bold tracking-wide">ARMED &amp; SENSING</span>
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

              {/* Detected Target Node: 3.2m Front Entrance Marker */}
              <div
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
                  <span>3.2m</span>
                  <span className="w-1 h-1 rounded-full bg-secondary-container" />
                  <span>94% PIR</span>
                </div>
              </div>

              {/* Center Sensor Anchor (ESP32 node location) */}
              <div className="relative z-20 flex flex-col items-center justify-center w-11 h-11 rounded-full bg-surface-container-lowest text-primary shadow-md">
                <span className="material-symbols-outlined text-[22px]">sensor_occupied</span>
              </div>

              {/* Live Angular Cone Mask Indicator */}
              <div className="absolute bottom-3 font-mono text-[10px] text-on-surface-variant bg-surface-container-lowest/90 px-2.5 py-0.5 rounded-full shadow-xs">
                Azimuth: +18.4°
              </div>
            </div>

            {/* Snapshot thumbnail integration */}
            <div className="w-full mt-3 pt-3 flex items-center justify-between bg-surface-container-low p-3 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 shadow-sm relative">
                  <img
                    className="w-full h-full object-cover"
                    src={BRAND_ASSETS.doorbellCam}
                    alt="Front camera snapshot"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-primary/80 py-0.2 flex justify-center">
                    <span className="text-[8px] font-mono text-on-primary font-bold">CAM-01</span>
                  </div>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-on-surface font-semibold truncate">
                    Front Walkway Stream
                  </span>
                  <span className="text-[11px] text-on-surface-variant truncate">
                    Entity classified: Human (Approaching)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-highest text-secondary text-[11px] font-semibold shrink-0">
                <span className="material-symbols-outlined text-[15px]">videocam</span>
                <span>Synced</span>
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

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setSensitivityModalOpen(true)}
                className="min-h-[44px] py-2.5 px-3 bg-surface-container-lowest text-on-surface rounded-xl shadow-sm flex items-center justify-center gap-1.5 hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">tune</span>
                <span className="text-xs font-semibold truncate">Adjust Sensitivity</span>
              </button>

              <button
                onClick={() => setIsChimeMuted(!isChimeMuted)}
                className={`min-h-[44px] py-2.5 px-3 rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-colors ${
                  isChimeMuted
                    ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                    : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isChimeMuted ? 'volume_off' : 'notifications_paused'}
                </span>
                <span className="text-xs font-semibold truncate">
                  {isChimeMuted ? `Chime Muted (${formatMuteTime(muteSecondsLeft)})` : 'Mute Chime (5m)'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Bento Telemetry & Security State Flow */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Real-time Telemetry Bento Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Motion State Card */}
            <div className="flex flex-col justify-between bg-surface-container-lowest p-3.5 rounded-xl shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-on-surface-variant">MOTION STATE</span>
                <span className="material-symbols-outlined text-secondary text-[18px]">directions_walk</span>
              </div>
              <div className="my-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                  DETECTED
                </span>
              </div>
              <div className="flex items-center gap-1 text-on-surface-variant">
                <span className="material-symbols-outlined text-[14px]">timer</span>
                <span className="font-mono text-xs">Active for {activeSeconds}s</span>
              </div>
            </div>

            {/* PIR Sensitivity Card */}
            <div className="flex flex-col justify-between bg-surface-container-lowest p-3.5 rounded-xl shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-on-surface-variant">PIR SENSITIVITY</span>
                <button
                  onClick={() => setSensitivityModalOpen(true)}
                  className="text-primary hover:opacity-80"
                >
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                </button>
              </div>
              <div className="my-1 flex flex-col">
                <span className="font-display font-semibold text-base text-on-surface">
                  {sensitivityLevel} (3.3V)
                </span>
                <span className="text-[11px] text-on-surface-variant">GPIO 14 High-Level</span>
              </div>
              <span className="text-[11px] text-primary font-semibold">Repeat Trigger Mode</span>
            </div>

            {/* False Positive Rejection Card */}
            <div className="flex flex-col justify-between bg-surface-container-lowest p-3.5 rounded-xl shadow-sm col-span-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[18px]">verified_user</span>
                  <span className="text-xs font-semibold text-on-surface">False Positive Rejection</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-primary text-[11px] font-semibold">
                  Filter Active
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <svg className="w-24 h-4 shrink-0" fill="none" viewBox="0 0 96 16">
                  <rect fill="#E5EEFF" height="8" rx="4" width="96" x="0" y="4" />
                  <rect fill="#005C55" height="8" rx="4" width="84" x="0" y="4" />
                </svg>
                <span className="text-[11px] text-on-surface-variant">
                  Optical thermal gradient algorithm rejected tree shadow sway at 14:02:11
                </span>
              </div>
            </div>
          </div>

          {/* Security State Transition Stepper */}
          <div className="flex flex-col bg-surface-container-lowest p-4 sm:p-5 rounded-xl shadow-sm gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-on-surface">Security Event Flow</span>
              <span className="font-mono text-[11px] text-on-surface-variant">Event #ESP-8841</span>
            </div>

            {/* Visual Sequential Steps */}
            <div className="flex flex-col gap-2 relative">
              {/* Step 1 */}
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-on-primary shrink-0">
                  <span className="material-symbols-outlined text-[14px]">check</span>
                </div>
                <div className="flex flex-1 items-center justify-between min-w-0">
                  <span className="text-xs text-on-surface font-medium truncate">
                    PIR Motion Sensor Triggered
                  </span>
                  <span className="font-mono text-[11px] text-outline shrink-0">14:04:02</span>
                </div>
              </div>

              <div className="w-0.5 h-3 bg-primary ml-[11px] -my-1 rounded-full" />

              {/* Step 2 */}
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-on-primary shrink-0">
                  <span className="material-symbols-outlined text-[14px]">check</span>
                </div>
                <div className="flex flex-1 items-center justify-between min-w-0">
                  <span className="text-xs text-on-surface font-medium truncate">
                    ESP32 MQTT Packet Published
                  </span>
                  <span className="font-mono text-[11px] text-outline shrink-0">14:04:03</span>
                </div>
              </div>

              <div className="w-0.5 h-3 bg-primary-container ml-[11px] -my-1 rounded-full" />

              {/* Step 3 (In Progress) */}
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shrink-0">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
                  </span>
                </div>
                <div className="flex flex-1 items-center justify-between min-w-0">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs text-secondary font-semibold truncate">
                      AI Security Voice Intercom Ready
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      Awaiting automated conversational greet
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-secondary px-2 py-0.5 bg-secondary-fixed rounded-full shrink-0">
                    In Progress
                  </span>
                </div>
              </div>

              <div className="w-0.5 h-3 bg-surface-container-highest ml-[11px] -my-1 rounded-full" />

              {/* Step 4 (Pending) */}
              <div className="flex items-center gap-3 opacity-60">
                <div className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant shrink-0">
                  <span className="material-symbols-outlined text-[14px]">radio_button_unchecked</span>
                </div>
                <div className="flex flex-1 items-center justify-between min-w-0">
                  <span className="text-xs text-on-surface truncate">Access Verification Result</span>
                  <span className="text-[11px] text-outline font-medium">Pending</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sensitivity Adjustment Modal */}
      {sensitivityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-surface-container">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">tune</span>
                <h3 className="font-display font-semibold text-sm text-[#0b1c30]">
                  HC-SR501 Sensor Calibration
                </h3>
              </div>
              <button
                onClick={() => setSensitivityModalOpen(false)}
                className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-xs text-[#3e4947]"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3">
              <label className="text-xs text-[#3e4947] block">
                Select Hardware Sensitivity Threshold:
              </label>
              <div className="grid grid-cols-3 gap-2 bg-surface-container p-1 rounded-xl">
                {(['Low', 'Medium', 'High'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setSensitivityLevel(lvl)}
                    className={`py-2 text-center text-xs rounded-lg transition-all ${
                      sensitivityLevel === lvl
                        ? 'bg-white text-primary font-bold shadow-xs'
                        : 'text-[#3e4947] hover:text-black'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#6e7977]">
                {sensitivityLevel === 'Low' && 'Low: 2.5m range threshold. Ignores sidewalk foot traffic.'}
                {sensitivityLevel === 'Medium' && 'Medium: 4.2m porch radius. Balanced for residential entry.'}
                {sensitivityLevel === 'High' && 'High: 7.0m extended range with 3.3V high sensitivity.'}
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSensitivityModalOpen(false)}
                className="w-full py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-container"
              >
                Save Calibration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
