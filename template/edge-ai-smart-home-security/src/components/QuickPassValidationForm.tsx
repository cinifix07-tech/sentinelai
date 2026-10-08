import React, { useState } from 'react';

interface QuickPassValidationFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (visitorName: string, passcode: string) => void;
}

interface FormState {
  fullName: string;
  contact: string;
  purpose: string;
  accessDate: string;
  timeSlot: string;
  securityPin: string;
  termsAccepted: boolean;
}

interface FormErrors {
  fullName?: string;
  contact?: string;
  purpose?: string;
  accessDate?: string;
  timeSlot?: string;
  securityPin?: string;
  termsAccepted?: string;
}

export const QuickPassValidationForm: React.FC<QuickPassValidationFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<FormState>({
    fullName: '',
    contact: '',
    purpose: '',
    accessDate: new Date().toISOString().split('T')[0],
    timeSlot: '14:00 – 18:00',
    securityPin: '',
    termsAccepted: false,
  });

  const [touched, setTouched] = useState<Record<keyof FormState, boolean>>({
    fullName: false,
    contact: false,
    purpose: false,
    accessDate: false,
    timeSlot: false,
    securityPin: false,
    termsAccepted: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Validation function
  const validate = (values: FormState): FormErrors => {
    const errors: FormErrors = {};

    // Full name validation
    if (!values.fullName.trim()) {
      errors.fullName = 'Full name is required.';
    } else if (values.fullName.trim().length < 3) {
      errors.fullName = 'Name must be at least 3 characters.';
    } else if (!/^[a-zA-Z\s\-'.]+$/.test(values.fullName.trim())) {
      errors.fullName = 'Name can only contain letters and standard punctuation.';
    }

    // Contact (Email or Phone) validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;
    if (!values.contact.trim()) {
      errors.contact = 'Email or phone number is required.';
    } else if (!emailRegex.test(values.contact.trim()) && !phoneRegex.test(values.contact.trim())) {
      errors.contact = 'Please enter a valid email address or phone number.';
    }

    // Purpose validation
    if (!values.purpose.trim()) {
      errors.purpose = 'Reason for access is required.';
    } else if (values.purpose.trim().length < 5) {
      errors.purpose = 'Please describe purpose in at least 5 characters.';
    }

    // Date validation
    if (!values.accessDate) {
      errors.accessDate = 'Please select an access date.';
    }

    // Time slot validation
    if (!values.timeSlot.trim()) {
      errors.timeSlot = 'Time slot is required.';
    }

    // 4-digit PIN validation
    if (!values.securityPin.trim()) {
      errors.securityPin = '4-digit PIN is required.';
    } else if (!/^\d{4}$/.test(values.securityPin.trim())) {
      errors.securityPin = 'PIN must be exactly 4 numerical digits (e.g. 4821).';
    }

    // Terms checkbox validation
    if (!values.termsAccepted) {
      errors.termsAccepted = 'You must authorize compliance with home perimeter security policies.';
    }

    return errors;
  };

  const errors = validate(formData);
  const isValid = Object.keys(errors).length === 0;

  const handleChange = (field: keyof FormState, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleBlur = (field: keyof FormState) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);

    // Mark all as touched
    setTouched({
      fullName: true,
      contact: true,
      purpose: true,
      accessDate: true,
      timeSlot: true,
      securityPin: true,
      termsAccepted: true,
    });

    if (!isValid) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccessMessage(`Access Authorized for ${formData.fullName}! PIN #${formData.securityPin} is now active.`);
      onSuccess(formData.fullName, formData.securityPin);
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 2000);
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-surface-container overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-surface-container flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-[#0b1c30]">
                Quick Visitor Access Authorization
              </h3>
              <p className="text-[11px] text-[#3e4947]">
                Validated entry pass for deliveries, contractors &amp; guests
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-xs text-[#3e4947] hover:text-black transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Success Banner */}
        {successMessage && (
          <div className="m-4 p-3.5 bg-[#eff4ff] border border-primary text-primary rounded-xl flex items-center gap-2.5 text-xs font-semibold animate-in zoom-in-95">
            <span className="material-symbols-outlined text-[22px]">check_circle</span>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="p-5 overflow-y-auto space-y-4 text-xs">
          {submitAttempted && !isValid && (
            <div className="p-3 rounded-xl bg-[#ffdad6] border border-[#ba1a1a]/30 text-[#93000a] flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span className="font-semibold text-[11px]">
                Please correct the highlighted fields before submitting.
              </span>
            </div>
          )}

          {/* Full Name */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-on-surface">
                Visitor Full Name <span className="text-[#ba1a1a]">*</span>
              </label>
              {touched.fullName && !errors.fullName && (
                <span className="text-primary text-[10px] flex items-center gap-0.5 font-bold">
                  ✓ Valid Name
                </span>
              )}
            </div>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              onBlur={() => handleBlur('fullName')}
              placeholder="e.g. Marcus Vance"
              className={`w-full h-10 px-3.5 rounded-xl border text-xs focus:outline-none transition-colors ${
                touched.fullName && errors.fullName
                  ? 'border-[#ba1a1a] bg-[#fff5f5] text-[#93000a] focus:ring-1 focus:ring-[#ba1a1a]'
                  : 'border-surface-container bg-surface-container-lowest focus:border-primary'
              }`}
            />
            {touched.fullName && errors.fullName && (
              <p className="text-[11px] text-[#ba1a1a] mt-1 font-medium">{errors.fullName}</p>
            )}
          </div>

          {/* Contact (Email or Mobile) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-on-surface">
                Mobile Number or Email <span className="text-[#ba1a1a]">*</span>
              </label>
              {touched.contact && !errors.contact && (
                <span className="text-primary text-[10px] flex items-center gap-0.5 font-bold">
                  ✓ Valid Contact
                </span>
              )}
            </div>
            <input
              type="text"
              value={formData.contact}
              onChange={(e) => handleChange('contact', e.target.value)}
              onBlur={() => handleBlur('contact')}
              placeholder="e.g. marcus@deliveries.com or (555) 234-5678"
              className={`w-full h-10 px-3.5 rounded-xl border text-xs focus:outline-none transition-colors ${
                touched.contact && errors.contact
                  ? 'border-[#ba1a1a] bg-[#fff5f5] text-[#93000a] focus:ring-1 focus:ring-[#ba1a1a]'
                  : 'border-surface-container bg-surface-container-lowest focus:border-primary'
              }`}
            />
            {touched.contact && errors.contact && (
              <p className="text-[11px] text-[#ba1a1a] mt-1 font-medium">{errors.contact}</p>
            )}
          </div>

          {/* Purpose of Visit */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-on-surface">
                Purpose &amp; Affiliation <span className="text-[#ba1a1a]">*</span>
              </label>
              {touched.purpose && !errors.purpose && (
                <span className="text-primary text-[10px] flex items-center gap-0.5 font-bold">
                  ✓ Valid Purpose
                </span>
              )}
            </div>
            <input
              type="text"
              value={formData.purpose}
              onChange={(e) => handleChange('purpose', e.target.value)}
              onBlur={() => handleBlur('purpose')}
              placeholder="e.g. UPS Overnight Parcel Delivery #492"
              className={`w-full h-10 px-3.5 rounded-xl border text-xs focus:outline-none transition-colors ${
                touched.purpose && errors.purpose
                  ? 'border-[#ba1a1a] bg-[#fff5f5] text-[#93000a] focus:ring-1 focus:ring-[#ba1a1a]'
                  : 'border-surface-container bg-surface-container-lowest focus:border-primary'
              }`}
            />
            {touched.purpose && errors.purpose && (
              <p className="text-[11px] text-[#ba1a1a] mt-1 font-medium">{errors.purpose}</p>
            )}
          </div>

          {/* Date & Time Slot Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-on-surface block mb-1">
                Access Date <span className="text-[#ba1a1a]">*</span>
              </label>
              <input
                type="date"
                value={formData.accessDate}
                onChange={(e) => handleChange('accessDate', e.target.value)}
                onBlur={() => handleBlur('accessDate')}
                className="w-full h-10 px-3 rounded-xl border border-surface-container bg-surface-container-lowest text-xs focus:outline-none focus:border-primary"
              />
              {touched.accessDate && errors.accessDate && (
                <p className="text-[11px] text-[#ba1a1a] mt-1 font-medium">{errors.accessDate}</p>
              )}
            </div>
            <div>
              <label className="font-semibold text-on-surface block mb-1">
                Time Window <span className="text-[#ba1a1a]">*</span>
              </label>
              <input
                type="text"
                value={formData.timeSlot}
                onChange={(e) => handleChange('timeSlot', e.target.value)}
                onBlur={() => handleBlur('timeSlot')}
                placeholder="14:00 – 18:00"
                className="w-full h-10 px-3 rounded-xl border border-surface-container bg-surface-container-lowest text-xs focus:outline-none focus:border-primary"
              />
              {touched.timeSlot && errors.timeSlot && (
                <p className="text-[11px] text-[#ba1a1a] mt-1 font-medium">{errors.timeSlot}</p>
              )}
            </div>
          </div>

          {/* 4-Digit Security PIN */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-on-surface">
                One-Time Strike PIN (4 Digits) <span className="text-[#ba1a1a]">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
                  handleChange('securityPin', randomPin);
                  handleBlur('securityPin');
                }}
                className="text-primary text-[11px] font-bold hover:underline"
              >
                Auto-Generate
              </button>
            </div>
            <input
              type="text"
              maxLength={4}
              value={formData.securityPin}
              onChange={(e) => handleChange('securityPin', e.target.value.replace(/\D/g, ''))}
              onBlur={() => handleBlur('securityPin')}
              placeholder="e.g. 7482"
              className={`w-full h-10 px-3.5 rounded-xl border font-mono tracking-widest text-center text-sm font-bold focus:outline-none transition-colors ${
                touched.securityPin && errors.securityPin
                  ? 'border-[#ba1a1a] bg-[#fff5f5] text-[#93000a] focus:ring-1 focus:ring-[#ba1a1a]'
                  : 'border-surface-container bg-surface-container-lowest focus:border-primary text-primary'
              }`}
            />
            {touched.securityPin && errors.securityPin && (
              <p className="text-[11px] text-[#ba1a1a] mt-1 font-medium">{errors.securityPin}</p>
            )}
          </div>

          {/* Terms Acceptance */}
          <div>
            <label className="flex items-start gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={formData.termsAccepted}
                onChange={(e) => handleChange('termsAccepted', e.target.checked)}
                onBlur={() => handleBlur('termsAccepted')}
                className="mt-0.5 w-4 h-4 rounded text-primary accent-primary"
              />
              <span className="text-[11px] text-[#3e4947] leading-tight">
                I verify that this visitor has legitimate business and is authorized for porch entry during this scheduled window.
              </span>
            </label>
            {touched.termsAccepted && errors.termsAccepted && (
              <p className="text-[11px] text-[#ba1a1a] mt-1 font-medium">{errors.termsAccepted}</p>
            )}
          </div>

          {/* Buttons */}
          <div className="pt-3 flex gap-2.5 border-t border-surface-container">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl bg-surface-container text-xs font-semibold text-[#3e4947] hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-11 rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary-container transition-colors shadow-sm flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  <span>Validating Pass...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>Authorize Visitor</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
