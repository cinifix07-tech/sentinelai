import React, { useState } from 'react';
import { Visitor } from '../../types';
import { INITIAL_VISITORS, INITIAL_ONE_TIME_PASSES } from '../../mockData';

interface VisitorsScreenProps {
  onOpenQuickPassForm?: () => void;
}

export const VisitorsScreen: React.FC<VisitorsScreenProps> = ({ onOpenQuickPassForm }) => {
  const [activeSegment, setActiveSegment] = useState<'scheduled' | 'passes' | 'rules'>('scheduled');
  const [visitors, setVisitors] = useState<Visitor[]>(INITIAL_VISITORS);
  const [oneTimePasses, setOneTimePasses] = useState<Visitor[]>(INITIAL_ONE_TIME_PASSES);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form states for new visitor with validation
  const [formData, setFormData] = useState({
    name: '',
    purpose: '',
    date: '2025-05-18',
    timeSlot: '09:00 – 17:00',
    preset: 'Carrier / Delivery: Ask for Tracking & Recipient Name',
    customQuestion: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ESP32 Rules state
  const [pirSensitivity, setPirSensitivity] = useState<'Low (2.5m)' | 'Medium (4.2m)' | 'High (7.0m)'>('Medium (4.2m)');
  const [autoGrant, setAutoGrant] = useState(true);
  const [pushApproval, setPushApproval] = useState(true);

  const handleRevoke = (id: string) => {
    setVisitors((prev) =>
      prev.map((v) => (v.id === id ? { ...v, status: 'expired' } : v))
    );
  };

  const handleReauthorize = (id: string) => {
    setVisitors((prev) =>
      prev.map((v) => (v.id === id ? { ...v, status: 'authorized' } : v))
    );
  };

  const handleCreateVisitor = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formData.name.trim() || formData.name.trim().length < 3) {
      errors.name = 'Full name must be at least 3 characters.';
    }
    if (!formData.purpose.trim()) {
      errors.purpose = 'Purpose of visit is required.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const newVis: Visitor = {
      id: `vis-${Date.now()}`,
      name: formData.name,
      affiliation: formData.purpose || 'Authorized Guest',
      role: 'Guest / Delivery',
      schedule: `Permitted: ${formData.timeSlot}`,
      scheduleType: 'today',
      status: 'authorized',
      ruleType: 'conversational',
      ruleDescription: `AI Rule: ${formData.preset}${formData.customQuestion ? ` • Q: "${formData.customQuestion}"` : ''}`,
      lastVisit: 'Pending arrival',
      photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBrlv8fD8ofaNVV111Eo5830gPipJ_gU3nKFbQ6XrVVqHNiG7ZG2gpryiN0_ZnmpiClg2Sy3Yi_SEKjdtqGaIvCEKboBK3H-QP9lLwRF_NKQmGqTI3am-hFG6ciMGLCdrBkgCrIoJcT1i9URhvYF1B_RluDikQqyieCOVyYTrKZ4T58HN6qSq3tgSrawdyu37PPlNkh-jR9NM7nfO28gIZorAxYbbszSW4wAvOWZPwP6KC6MensGHx-',
    };

    setVisitors([newVis, ...visitors]);
    setIsAddModalOpen(false);
    setFormErrors({});
    setFormData({
      name: '',
      purpose: '',
      date: '2025-05-18',
      timeSlot: '09:00 – 17:00',
      preset: 'Carrier / Delivery: Ask for Tracking & Recipient Name',
      customQuestion: '',
    });
  };

  return (
    <div className="flex flex-col w-full gap-5 max-w-7xl mx-auto pb-24">
      {/* Top Hero Header Area */}
      <section className="flex flex-col w-full bg-surface-container-lowest rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-[11px] font-semibold text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Perimeter Shield Active
              </span>
            </div>
            <h1 className="font-display font-bold text-xl sm:text-2xl text-on-surface tracking-tight">
              Visitor Management &amp; Access Control
            </h1>
            <p className="text-[12px] text-on-surface-variant mt-0.5">
              Configure conversational verification rules, one-time pin passes, and authorized schedules.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="h-11 px-5 bg-primary hover:bg-primary-container text-on-primary rounded-full text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all duration-150 active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>+ Add Visitor</span>
            </button>
            {onOpenQuickPassForm && (
              <button
                onClick={onOpenQuickPassForm}
                className="h-11 px-4 bg-secondary-fixed text-on-secondary-fixed hover:bg-secondary-fixed-dim rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
                <span className="hidden sm:inline">Validated Pass</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 cols): Navigation Tabs & Visitor Cards */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Interactive Segmented Navigation Tabs */}
          <div className="flex p-1.5 bg-surface-container-lowest rounded-xl shadow-xs gap-1 border border-surface-container">
            <button
              onClick={() => setActiveSegment('scheduled')}
              className={`tab-pill flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all duration-150 ${
                activeSegment === 'scheduled'
                  ? 'text-white bg-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Scheduled ({visitors.length})
            </button>
            <button
              onClick={() => setActiveSegment('passes')}
              className={`tab-pill flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all duration-150 ${
                activeSegment === 'passes'
                  ? 'text-white bg-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              One-Time Passes ({oneTimePasses.length})
            </button>
            <button
              onClick={() => setActiveSegment('rules')}
              className={`tab-pill flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all duration-150 ${
                activeSegment === 'rules'
                  ? 'text-white bg-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Rules &amp; ESP32
            </button>
          </div>

          {/* Scheduled Visitors View */}
          {activeSegment === 'scheduled' && (
            <div className="flex flex-col space-y-3">
              {visitors.map((visitor) => {
                const isAuthorized = visitor.status === 'authorized';
                const isPending = visitor.status === 'pending';
                return (
                  <article
                    key={visitor.id}
                    className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 shadow-sm flex flex-col gap-2.5 transition-shadow duration-150 border border-surface-container/60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0 w-12 h-12 rounded-full overflow-hidden bg-surface-container shadow-xs">
                          <img
                            className="w-full h-full object-cover"
                            src={visitor.photoUrl}
                            alt={visitor.name}
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-display font-semibold text-sm text-on-surface truncate">
                            {visitor.name} ({visitor.affiliation})
                          </span>
                          <div className="flex items-center gap-1 text-on-surface-variant text-[11px] mt-0.5">
                            <span className="material-symbols-outlined text-[15px] text-secondary">
                              {visitor.schedule.includes('Fridays')
                                ? 'event_repeat'
                                : visitor.schedule.includes('Tue')
                                ? 'date_range'
                                : 'schedule'}
                            </span>
                            <span>{visitor.schedule}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${
                          isAuthorized
                            ? 'bg-primary-fixed text-on-primary-fixed-variant'
                            : isPending
                            ? 'bg-secondary-fixed text-on-secondary-fixed'
                            : 'bg-error-container text-on-error-container'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {isAuthorized ? 'check_circle' : isPending ? 'pending' : 'cancel'}
                        </span>
                        <span>{isAuthorized ? 'Authorized' : isPending ? 'Pending Renewal' : 'Revoked'}</span>
                      </span>
                    </div>

                    {/* Verification Rule Box */}
                    <div className="bg-surface-container-low rounded-xl p-3 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-primary text-[11px] font-semibold">
                        <span className="material-symbols-outlined text-[16px]">
                          {visitor.ruleType === 'biometric' ? 'graphic_eq' : isPending ? 'info' : 'record_voice_over'}
                        </span>
                        <span>
                          {visitor.ruleType === 'biometric'
                            ? 'Voice Biometric & Safe Phrase'
                            : isPending
                            ? 'Access Expired'
                            : 'Conversational Rule'}
                        </span>
                      </div>
                      <p className="text-[12px] text-on-surface-variant leading-relaxed">
                        {visitor.ruleDescription}
                      </p>
                    </div>

                    {/* Footer metadata & buttons */}
                    <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-tertiary">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">history</span>
                        Last Visit: {visitor.lastVisit}
                      </span>
                      <div className="flex items-center gap-2">
                        {isAuthorized ? (
                          <>
                            <button
                              onClick={() => alert(`Edit parameters for ${visitor.name}`)}
                              className="px-3 h-8 rounded-full bg-surface-container text-on-surface text-[11px] font-semibold hover:bg-surface-container-high transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleRevoke(visitor.id)}
                              className="px-3 h-8 rounded-full bg-error-container text-on-error-container text-[11px] font-semibold transition-colors active:opacity-80"
                            >
                              Revoke
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleReauthorize(visitor.id)}
                            className="px-3 h-8 rounded-full bg-primary text-on-primary text-[11px] font-semibold hover:bg-primary-container transition-colors shadow-xs"
                          >
                            Re-Authorize
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* One-Time Passes View */}
          {activeSegment === 'passes' && (
            <div className="flex flex-col space-y-3">
              {oneTimePasses.map((pass) => (
                <article
                  key={pass.id}
                  className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 shadow-sm flex flex-col gap-2.5 border border-surface-container/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-container shrink-0">
                        <img className="w-full h-full object-cover" src={pass.photoUrl} alt={pass.name} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-display font-semibold text-sm text-on-surface truncate">
                          {pass.name}
                        </span>
                        <span className="text-[11px] text-on-surface-variant font-mono">{pass.schedule}</span>
                      </div>
                    </div>
                    {pass.passcode && (
                      <span className="px-3 py-1 bg-surface-container rounded-lg font-mono text-xs font-bold text-primary">
                        PIN: {pass.passcode}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant">{pass.ruleDescription}</p>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Right Column (5 cols): ESP32 & System Security Rules */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <section className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 shadow-sm flex flex-col space-y-4 border border-surface-container/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">memory</span>
                </div>
                <div>
                  <h2 className="font-display font-semibold text-sm text-on-surface leading-tight">
                    ESP32 &amp; Perimeter Rules
                  </h2>
                  <span className="text-[11px] text-on-surface-variant">
                    Hardware sensor sensitivity &amp; automation policies
                  </span>
                </div>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" title="Controller Online" />
            </div>

            {/* HC-SR501 Sensitivity Selector */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-secondary">
                    motion_photos_auto
                  </span>
                  HC-SR501 PIR Sensitivity
                </span>
                <span className="font-mono text-xs text-primary font-bold">{pirSensitivity}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 bg-surface-container p-1 rounded-lg">
                {(['Low (2.5m)', 'Medium (4.2m)', 'High (7.0m)'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setPirSensitivity(lvl)}
                    className={`py-1.5 text-center text-xs rounded font-medium transition-all ${
                      pirSensitivity === lvl
                        ? 'bg-surface-container-lowest text-primary font-bold shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {lvl.split(' ')[0]}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Controls infrared triggering radius for doorway radar sweep and camera wakeups.
              </p>
            </div>

            {/* Smart Automation Toggles */}
            <div className="flex flex-col space-y-2.5 pt-1">
              {/* Toggle 1 */}
              <label className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl cursor-pointer">
                <div className="flex flex-col pr-3">
                  <span className="text-xs font-semibold text-on-surface">Auto-Grant on Schedule Match</span>
                  <span className="text-[11px] text-on-surface-variant">
                    Unlock strike latch once voice passes AI verification rule.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoGrant}
                  onChange={(e) => setAutoGrant(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-surface-variant rounded-full peer peer-checked:bg-primary relative transition-colors duration-200">
                  <div className="w-5 h-5 bg-surface-container-lowest rounded-full absolute top-0.5 left-0.5 peer-checked:translate-x-6 transition-transform duration-200 shadow-sm" />
                </div>
              </label>

              {/* Toggle 2 */}
              <label className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl cursor-pointer">
                <div className="flex flex-col pr-3">
                  <span className="text-xs font-semibold text-on-surface">Push Approval for Unknowns</span>
                  <span className="text-[11px] text-on-surface-variant">
                    Transmit high-priority alert to mobile phone if visitor intent is unverified.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={pushApproval}
                  onChange={(e) => setPushApproval(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-surface-variant rounded-full peer peer-checked:bg-primary relative transition-colors duration-200">
                  <div className="w-5 h-5 bg-surface-container-lowest rounded-full absolute top-0.5 left-0.5 peer-checked:translate-x-6 transition-transform duration-200 shadow-sm" />
                </div>
              </label>
            </div>

            {/* MQTT Broker Status Pill Banner */}
            <div className="bg-surface-container p-3 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[20px] text-secondary">hub</span>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-on-surface font-semibold truncate">
                    MQTT Broker: Connected
                  </span>
                  <span className="font-mono text-[11px] text-on-surface-variant truncate">
                    broker.sentinel-security.local:8883
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed text-[11px] font-bold shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                TLS 1.3
              </span>
            </div>
          </section>
        </div>
      </div>

      {/* Add Visitor Drawer / Sheet Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-5 shadow-2xl flex flex-col space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-container pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">person_add</span>
                <h3 className="font-display font-semibold text-base text-on-surface">
                  New Authorized Visitor Rule
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface"
              >
                ✕
              </button>
            </div>

            {/* Form Fields with Validation */}
            <form onSubmit={handleCreateVisitor} noValidate className="flex flex-col space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-on-surface-variant mb-1 block">
                  Full Name &amp; Affiliation <span className="text-[#ba1a1a]">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Marcus Vance (USPS)"
                  className={`w-full h-11 px-3.5 rounded-xl text-xs text-on-surface focus:outline-none border ${
                    formErrors.name
                      ? 'border-[#ba1a1a] bg-[#fff5f5]'
                      : 'border-surface-container bg-surface-container-low focus:border-primary'
                  }`}
                />
                {formErrors.name && (
                  <p className="text-[11px] text-[#ba1a1a] mt-1">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label className="text-[11px] font-semibold text-on-surface-variant mb-1 block">
                  Purpose of Visit <span className="text-[#ba1a1a]">*</span>
                </label>
                <input
                  type="text"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  placeholder="Package Delivery, Maintenance, Guest"
                  className={`w-full h-11 px-3.5 rounded-xl text-xs text-on-surface focus:outline-none border ${
                    formErrors.purpose
                      ? 'border-[#ba1a1a] bg-[#fff5f5]'
                      : 'border-surface-container bg-surface-container-low focus:border-primary'
                  }`}
                />
                {formErrors.purpose && (
                  <p className="text-[11px] text-[#ba1a1a] mt-1">{formErrors.purpose}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-on-surface-variant mb-1 block">
                    Permitted Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full h-11 px-3 rounded-xl bg-surface-container-low text-xs text-on-surface focus:outline-none border border-surface-container"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-on-surface-variant mb-1 block">
                    Time Slot
                  </label>
                  <input
                    type="text"
                    value={formData.timeSlot}
                    onChange={(e) => setFormData({ ...formData, timeSlot: e.target.value })}
                    className="w-full h-11 px-3 rounded-xl bg-surface-container-low text-xs text-on-surface focus:outline-none border border-surface-container"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-on-surface-variant mb-1 block">
                  Conversational AI Security Preset
                </label>
                <select
                  value={formData.preset}
                  onChange={(e) => setFormData({ ...formData, preset: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low text-xs text-on-surface focus:outline-none border border-surface-container"
                >
                  <option>Carrier / Delivery: Ask for Tracking &amp; Recipient Name</option>
                  <option>Contractor: Verify Company Name + Work Order ID</option>
                  <option>Social Guest: Friendly Greeting + Secret Passphrase</option>
                  <option>Strict High-Security: Biometric voice match only</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-on-surface-variant mb-1 block">
                  Custom AI Question (Optional)
                </label>
                <input
                  type="text"
                  value={formData.customQuestion}
                  onChange={(e) => setFormData({ ...formData, customQuestion: e.target.value })}
                  placeholder='"Who scheduled your appointment today?"'
                  className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low text-xs text-on-surface focus:outline-none border border-surface-container"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 h-11 rounded-xl bg-surface-container text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-11 rounded-xl bg-primary text-xs font-semibold text-on-primary hover:bg-primary-container transition-colors shadow-xs"
                >
                  Create Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
