import React, { useState } from 'react';
import { DialogueMessage } from '../../types';
import { INITIAL_DIALOGUE } from '../../mockData';

interface VoiceScreenProps {
  onUnlockDoor?: () => void;
}

export const VoiceScreen: React.FC<VoiceScreenProps> = ({ onUnlockDoor }) => {
  const [dialogue, setDialogue] = useState<DialogueMessage[]>(INITIAL_DIALOGUE);
  const [isMicActive, setIsMicActive] = useState(true);
  const [isTakeoverActive, setIsTakeoverActive] = useState(false);
  const [isAiInterrupted, setIsAiInterrupted] = useState(false);
  const [unlockedSuccess, setUnlockedSuccess] = useState(false);
  const [userCustomInput, setUserCustomInput] = useState('');

  const handleToggleMic = () => {
    setIsMicActive(!isMicActive);
  };

  const handleInterruptAi = () => {
    setIsAiInterrupted(!isAiInterrupted);
  };

  const handleTakeover = () => {
    setIsTakeoverActive(!isTakeoverActive);
  };

  const handleUnlockClick = () => {
    setUnlockedSuccess(true);
    if (onUnlockDoor) onUnlockDoor();
    setTimeout(() => setUnlockedSuccess(false), 3000);
  };

  const handleSendTestUtterance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userCustomInput.trim()) return;

    const newVisitorMsg: DialogueMessage = {
      id: `vis-${Date.now()}`,
      sender: isTakeoverActive ? 'operator' : 'visitor',
      time: '14:35',
      text: userCustomInput,
    };

    setDialogue((prev) => [...prev, newVisitorMsg]);
    setUserCustomInput('');

    // Simulate AI response after 1s
    if (!isTakeoverActive && !isAiInterrupted) {
      setTimeout(() => {
        const aiReplies = [
          'Affirmative. The credentials match our residential authorized carrier directory.',
          'Understood. Please place the delivery into the parcel locker on the left porch wall.',
          'Package tracking ID logged into building security ledger. Access authorized.',
        ];
        const randomReply = aiReplies[Math.floor(Math.random() * aiReplies.length)];
        setDialogue((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            time: '14:35',
            text: randomReply,
          },
        ]);
      }, 1000);
    }
  };

  return (
    <div className="flex flex-col w-full gap-5 max-w-7xl mx-auto pb-24">
      {/* Header status pills */}
      <div className="flex flex-col bg-surface-container-lowest p-4 sm:p-5 rounded-xl shadow-sm gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed shadow-sm">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
              <span className="text-[11px] uppercase tracking-wider font-bold">
                {isMicActive ? 'Listening & Verifying' : 'Intercom Standby'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-on-surface-variant font-mono text-[12px]">
              <span className="material-symbols-outlined text-[16px] text-secondary">sensors</span>
              <span>PIR Zone 1</span>
            </div>
          </div>
          <span className="text-[11px] text-primary font-mono font-bold self-start sm:self-auto">
            Session #AI-8839-ENC
          </span>
        </div>

        <div className="flex flex-col mt-1">
          <h1 className="font-display font-bold text-2xl text-on-surface tracking-tight">
            AI Security Assistant
          </h1>
          <p className="text-[12px] text-on-surface-variant flex items-center gap-1 mt-0.5">
            <span className="material-symbols-outlined text-[15px] text-tertiary">
              motion_sensor_active
            </span>
            <span>Unknown Visitor • Triggered by Front HC-SR501 PIR (14:32:50)</span>
          </p>
        </div>
      </div>

      {/* Responsive Grid: Left (Transcript & Verification) | Right (Intercom Controller & Waveform) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 cols on lg screens): Verification Status & Live Dialogue */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Verification Status Card */}
          <div className="w-full rounded-xl bg-surface-container-lowest p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">
                Verification Status
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container text-primary text-[11px] font-bold shadow-xs">
                <span className="material-symbols-outlined text-[14px]">sync</span>
                IN PROGRESS (3/3)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="bg-surface-container-low rounded-xl p-3 flex flex-col justify-between">
                <span className="text-[11px] text-on-surface-variant font-medium">Declared Purpose</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="material-symbols-outlined text-secondary text-[20px]">inventory_2</span>
                  <span className="font-display font-semibold text-sm text-on-surface leading-snug">
                    Package Delivery
                  </span>
                </div>
              </div>
              <div className="bg-surface-container-low rounded-xl p-3 flex flex-col justify-between">
                <span className="text-[11px] text-on-surface-variant font-medium">Matched Rule</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="material-symbols-outlined text-primary text-[20px]">event_available</span>
                  <span className="text-xs text-on-surface font-semibold truncate">
                    FedEx Window
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 bg-surface-container-low rounded-xl p-3">
              <div className="flex items-center justify-between text-on-surface-variant text-[11px]">
                <span>Carrier Manifest Match</span>
                <span className="font-mono text-primary font-bold">14:00 – 16:00</span>
              </div>
              <div className="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden">
                <div className="bg-primary h-full rounded-full w-4/5 transition-all duration-500" />
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-low text-primary text-[11px] font-semibold shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                AUTHORIZED: Scheduled Window
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-low text-tertiary text-[11px] font-semibold shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                UNKNOWN: Visitor Name
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-low text-on-surface-variant/60 text-[11px] font-semibold shrink-0 opacity-70">
                <span className="w-1.5 h-1.5 rounded-full bg-outline-variant" />
                OFF-HOURS RULE: Inactive
              </span>
            </div>
          </div>

          {/* Live Dialogue Transcript */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Live Dialogue Transcript
              </span>
              <span className="font-mono text-xs text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">graphic_eq</span> Audio Stream Encrypted
              </span>
            </div>

            <div className="flex flex-col space-y-3 bg-surface-container-low p-4 sm:p-5 rounded-xl border border-surface-container">
              {dialogue.map((msg) => {
                const isAi = msg.sender === 'ai';
                const isOperator = msg.sender === 'operator';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col space-y-1 max-w-[85%] ${
                      isAi ? 'items-start' : 'items-end self-end'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 px-1">
                      {isAi ? (
                        <>
                          <span className="material-symbols-outlined text-[14px] text-primary">smart_toy</span>
                          <span className="text-[11px] text-primary font-bold">AI Assistant</span>
                        </>
                      ) : isOperator ? (
                        <>
                          <span className="text-[11px] text-primary font-bold">Resident (Takeover)</span>
                          <span className="material-symbols-outlined text-[14px] text-primary">mic</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[11px] text-secondary font-bold">Front Visitor</span>
                          <span className="material-symbols-outlined text-[14px] text-secondary">record_voice_over</span>
                        </>
                      )}
                      <span className="font-mono text-[10px] text-on-surface-variant/70">{msg.time}</span>
                    </div>

                    <div
                      className={`p-3 text-xs leading-relaxed shadow-xs ${
                        isAi
                          ? 'bg-surface-container-lowest text-on-surface rounded-2xl rounded-tl-sm'
                          : isOperator
                          ? 'bg-primary text-white rounded-2xl rounded-tr-sm'
                          : 'bg-secondary-fixed text-on-secondary-fixed rounded-2xl rounded-tr-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}

              {/* System Rule Evaluation Callout */}
              <div className="w-full bg-surface-container-highest rounded-xl p-3 flex items-start gap-2.5 my-1 border border-surface-container">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">
                  verified_user
                </span>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[11px] text-on-surface font-bold">System Rule Evaluation</span>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Rule check: Authorized window 08:00 – 17:00. Verification code matched on delivery manifest for Resident Sarah Chen.
                  </p>
                </div>
              </div>

              {/* Test Visitor Response Input Form */}
              <form onSubmit={handleSendTestUtterance} className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={userCustomInput}
                  onChange={(e) => setUserCustomInput(e.target.value)}
                  placeholder={
                    isTakeoverActive
                      ? "Speak to visitor via operator intercom..."
                      : "Type simulated visitor response (e.g. 'Yes, package is FedEx #402')..."
                  }
                  className="flex-1 h-10 px-3.5 rounded-xl bg-surface-container-lowest text-xs border border-surface-container focus:outline-none focus:border-primary text-on-surface placeholder:text-outline"
                />
                <button
                  type="submit"
                  className="px-4 h-10 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary-container transition-colors shrink-0 shadow-xs"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols on lg screens): Audio Waveform & Intercom Controller */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Unlock success banner */}
          {unlockedSuccess && (
            <div className="bg-[#eff4ff] border border-primary text-primary p-3 rounded-xl flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">door_open</span>
                <span className="text-xs font-semibold">Front Porch Strike Latch Unlocked</span>
              </div>
              <span className="text-[11px] font-mono font-bold">00:08</span>
            </div>
          )}

          {/* Audio Waveform & Intercom Controller */}
          <div className="w-full rounded-2xl bg-surface-container-lowest p-5 sm:p-6 shadow-sm flex flex-col items-center space-y-4 border border-surface-container">
            <span className="text-xs font-semibold text-on-surface uppercase tracking-wider">
              Perimeter Two-Way Intercom
            </span>

            {/* Real-time multi-bar waveform visualizer */}
            <div className="w-full h-16 flex items-center justify-center gap-1.5 px-4 overflow-hidden bg-surface-container-low rounded-xl py-2">
              {[
                { h: 'h-3', delay: '0ms', color: 'bg-primary/40' },
                { h: 'h-6', delay: '100ms', color: 'bg-primary/60' },
                { h: 'h-10', delay: '250ms', color: 'bg-primary' },
                { h: 'h-12', delay: '150ms', color: 'bg-primary-container' },
                { h: 'h-8', delay: '300ms', color: 'bg-primary' },
                { h: 'h-5', delay: '200ms', color: 'bg-secondary-container' },
                { h: 'h-9', delay: '50ms', color: 'bg-secondary' },
                { h: 'h-14', delay: '350ms', color: 'bg-primary' },
                { h: 'h-11', delay: '180ms', color: 'bg-primary-container' },
                { h: 'h-6', delay: '220ms', color: 'bg-primary' },
                { h: 'h-8', delay: '310ms', color: 'bg-secondary' },
                { h: 'h-12', delay: '90ms', color: 'bg-primary/80' },
                { h: 'h-7', delay: '170ms', color: 'bg-primary/40' },
                { h: 'h-4', delay: '280ms', color: 'bg-primary/60' },
              ].map((bar, i) => (
                <span
                  key={i}
                  className={`w-1.5 rounded-full ${bar.color} ${bar.h} ${
                    isMicActive ? 'animate-pulse' : 'h-1.5'
                  }`}
                  style={{ animationDelay: bar.delay }}
                />
              ))}
            </div>

            <p className="text-[12px] text-center text-on-surface-variant italic px-2 leading-relaxed">
              {isTakeoverActive
                ? "Operator Takeover Active: Speaking directly to front entrance speaker."
                : "“Speak naturally. The AI assistant is verifying the visit through security rules.”"}
            </p>

            {/* Large microphone button */}
            <div className="relative flex items-center justify-center my-2">
              {isMicActive && (
                <span className="absolute w-24 h-24 rounded-full bg-primary-fixed animate-ping opacity-30" />
              )}
              <button
                aria-label="Intercom Voice Activation"
                onClick={handleToggleMic}
                className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                  isMicActive ? 'bg-primary text-on-primary' : 'bg-secondary text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[36px]">
                  {isMicActive ? 'mic' : 'mic_off'}
                </span>
              </button>
            </div>

            {/* Action Controls */}
            <div className="grid grid-cols-3 gap-2 w-full pt-2">
              {/* Action 1: Interrupt AI */}
              <button
                onClick={handleInterruptAi}
                className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl transition-colors min-h-[48px] ${
                  isAiInterrupted
                    ? 'bg-tertiary text-white'
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[22px] text-tertiary">
                  {isAiInterrupted ? 'play_arrow' : 'pause_circle'}
                </span>
                <span className="text-[11px] font-medium text-center leading-tight">
                  {isAiInterrupted ? 'Resume AI' : 'Interrupt AI'}
                </span>
              </button>

              {/* Action 2: Takeover */}
              <button
                onClick={handleTakeover}
                className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl transition-colors min-h-[48px] ${
                  isTakeoverActive
                    ? 'bg-secondary text-white'
                    : 'bg-secondary-fixed text-on-secondary-fixed hover:opacity-90'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">phone_in_talk</span>
                <span className="text-[11px] font-semibold text-center leading-tight">
                  {isTakeoverActive ? 'Release Call' : 'Takeover'}
                </span>
              </button>

              {/* Action 3: Unlock */}
              <button
                onClick={handleUnlockClick}
                className="flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl bg-surface-container text-primary hover:bg-primary-fixed transition-colors min-h-[48px]"
              >
                <span className="material-symbols-outlined text-[22px]">lock_open</span>
                <span className="text-[11px] font-bold text-center leading-tight">Unlock</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
