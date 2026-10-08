import { useState } from 'react'
import logoAsset from '../assets/logo.png'
import { clearSession, loginToBackend, resetPassword, roleHome, saveSession, sendResetOtp, verifyResetOtp } from '../api.js'
import './login.css'

export default function Login({ onAuthenticated }) {
  const [email, setEmail] = useState('admin@cinifix.com')
  const [password, setPassword] = useState('0147')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(true)
  const [loginTheme, setLoginTheme] = useState('daylight')
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState(email)
  const [resetNewPassword, setResetNewPassword] = useState('')
  const [resetConfirmPassword, setResetConfirmPassword] = useState('')
  const [resetAuthenticated, setResetAuthenticated] = useState(false)
  const [resetAccount, setResetAccount] = useState(null)
  const [resetOtpSent, setResetOtpSent] = useState(false)
  const [resetOtpCode, setResetOtpCode] = useState('')
  const [gmailBusy, setGmailBusy] = useState(false)
  const [otpBusy, setOtpBusy] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState('')
  const themes = [
    { id: 'daylight', label: 'Daylight Calm', swatch: 'bg-[#f8f9ff]' },
    { id: 'twilight', label: 'Twilight Slate', swatch: 'bg-[#283541]' },
    { id: 'midnight', label: 'Midnight Patrol', swatch: 'bg-[#1c252e]' },
    { id: 'sage', label: 'Sage Garden', swatch: 'bg-[#e6eee7]' },
  ]

  function openResetModal() {
    setResetEmail(email.trim())
    setResetNewPassword('')
    setResetConfirmPassword('')
    setResetAuthenticated(false)
    setResetAccount(null)
    setResetOtpSent(false)
    setResetOtpCode('')
    setGmailBusy(false)
    setOtpBusy(false)
    setResetError('')
    setResetSuccess('')
    setResetOpen(true)
  }

  function closeResetModal() {
    if (resetBusy || gmailBusy || otpBusy) return
    setResetOpen(false)
  }

  function updateResetEmail(value) {
    setResetEmail(value)
    setResetAuthenticated(false)
    setResetAccount(null)
    setResetOtpSent(false)
    setResetOtpCode('')
    setResetError('')
    setResetSuccess('')
  }

  async function handleSendOtp() {
    setResetError('')
    setResetSuccess('')
    setGmailBusy(true)

    try {
      const result = await sendResetOtp(resetEmail.trim())
      setResetOtpSent(true)
      setResetAuthenticated(false)
      setResetOtpCode(result.dev_otp || '')
      setResetAccount(result.user || { email: resetEmail.trim() })
      setResetSuccess(result.dev_otp ? `${result.message} Dev OTP: ${result.dev_otp}` : result.message || 'OTP sent to Gmail.')
    } catch (error) {
      setResetOtpSent(false)
      setResetAuthenticated(false)
      setResetAccount(null)
      setResetError(error.message || 'Unable to send OTP.')
    } finally {
      setGmailBusy(false)
    }
  }

  async function handleVerifyOtp() {
    setResetError('')
    setResetSuccess('')
    setOtpBusy(true)

    try {
      const result = await verifyResetOtp(resetEmail.trim(), resetOtpCode.trim())
      setResetAuthenticated(true)
      setResetSuccess(result.message || 'OTP verified. You can now change your password.')
    } catch (error) {
      setResetAuthenticated(false)
      setResetError(error.message || 'Unable to verify OTP.')
    } finally {
      setOtpBusy(false)
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault()
    setResetError('')
    setResetSuccess('')

    if (!resetAuthenticated) {
      setResetError('Authenticate your Gmail account before changing the password.')
      return
    }

    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('New password and confirmation do not match.')
      return
    }

    setResetBusy(true)
    try {
      const result = await resetPassword(resetEmail.trim(), resetNewPassword)
      setEmail(resetEmail.trim())
      setPassword(resetNewPassword)
      setResetSuccess(result.message || 'Password updated successfully. You can now sign in.')
      setTimeout(() => setResetOpen(false), 900)
    } catch (error) {
      setResetError(error.message || 'Unable to update password.')
    } finally {
      setResetBusy(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    clearSession()

    try {
      const session = await loginToBackend(email.trim(), password)
      if (session.role !== 'ADMIN') {
        const clientUrl = roleHome(session.role)
        if (clientUrl) {
          window.location.assign(clientUrl)
          return
        }
        setError('This account is for the client portal. Please sign in through the user app.')
        return
      }

      saveSession(session, rememberDevice)
      if (onAuthenticated) {
        onAuthenticated(session)
        return
      }
      window.history.pushState({}, '', '/home')
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch (error) {
      setError(error.message || 'Unable to sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`neo-admin neo-login theme-${loginTheme} min-h-screen bg-surface font-body-md text-on-surface antialiased flex flex-col`}>
      <header className="w-full bg-[#f8f9ff]/90 backdrop-blur-xl border-b border-surface-container-high/60 shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-colors duration-300">
        <div className="h-20 w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 select-none">
            <img src={logoAsset} alt="Sentinel AI Emblem" className="h-9 w-9 object-contain shrink-0" />
            <div className="flex min-w-0 flex-col">
              <span className="font-display font-bold text-lg tracking-tight text-[#0b1c30] leading-none truncate">SENTINEL AI</span>
              <span className="mt-0.5 text-[11px] font-medium leading-tight text-[#3e4947] truncate">Smart Home Security</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <button type="button" aria-label="Change login color theme" title="Change Background Color & Atmosphere" onClick={() => setShowThemeMenu((visible) => !visible)} className="grid h-10 w-10 place-items-center rounded-full bg-surface-container-low text-[#3e4947] shadow-inner transition hover:text-[#0b1c30]">
                <span className="material-symbols-outlined text-[20px]">palette</span>
              </button>
              {showThemeMenu ? (
                <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-surface-container bg-white p-2 shadow-xl z-50">
                  <div className="border-b border-surface-container px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0b1c30]">Login atmosphere</div>
                  <div className="space-y-1 py-1">
                    {themes.map((theme) => (
                      <button key={theme.id} type="button" onClick={() => { setLoginTheme(theme.id); setShowThemeMenu(false) }} className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition-colors ${loginTheme === theme.id ? 'bg-primary text-white font-semibold' : 'text-[#3e4947] hover:bg-surface-container'}`}>
                        <span className={`h-3.5 w-3.5 rounded-full border border-black/20 ${theme.swatch}`} />
                        <span>{theme.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-1.5 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="material-symbols-outlined text-[17px] text-primary">lock</span>
              <span className="font-mono text-[11px] text-on-surface-variant uppercase tracking-wider">TLS 1.3 Active</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-xl mx-auto px-4 sm:px-6 py-8 md:py-12 flex items-center">
        <div className="w-full">
          <section aria-label="Sign in" className="w-full">
            <div className="w-full bg-surface-container-lowest p-8 sm:p-10 rounded-xl shadow-md">
              <div className="mb-8 flex flex-col items-center text-center">
                <img src={logoAsset} alt="Sentinel AI" className="h-14 w-14 object-contain" />
                <span className="mt-3 font-display text-xl font-bold tracking-tight text-[#0b1c30]">Sentinel AI</span>
              </div>
              <form className="space-y-5" onSubmit={handleSubmit} noValidate>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between"><label htmlFor="identity" className="text-sm font-medium"> Email Address</label></div>
                  <div className="relative flex items-center"><span className="material-symbols-outlined absolute left-3.5 text-[20px] text-on-surface-variant pointer-events-none">alternate_email</span><input id="identity" name="email" value={email} onChange={(event) => { setEmail(event.target.value); setError('') }} autoComplete="username" className="w-full h-11 pl-11 pr-4 rounded-lg bg-surface text-sm placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-surface-container-lowest transition-colors shadow-inner" placeholder="admin@cinifix.com" required /></div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between"><label htmlFor="password" className="text-sm font-medium">Password</label></div>
                  <div className="relative flex items-center"><span className="material-symbols-outlined absolute left-3.5 text-[20px] text-on-surface-variant pointer-events-none">lock</span><input id="password" name="password" value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} autoComplete="current-password" type={showPassword ? 'text' : 'password'} className="w-full h-11 pl-11 pr-11 rounded-lg bg-surface text-sm placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-surface-container-lowest transition-colors shadow-inner" placeholder="Enter your password" required /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 p-1 text-on-surface-variant hover:text-on-surface"><span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span></button></div>
                </div>

                {error ? <p role="alert" className="rounded-lg border border-error/25 bg-error-container px-3 py-2.5 text-xs font-medium text-on-error-container">{error}</p> : null}

                <div className="flex items-center justify-between pt-1"><label className="inline-flex items-center gap-2 cursor-pointer text-sm text-on-surface-variant"><input type="checkbox" checked={rememberDevice} onChange={(event) => setRememberDevice(event.target.checked)} className="w-4 h-4 rounded accent-primary" />Remember this device</label><button type="button" onClick={openResetModal} className="text-xs text-primary hover:text-primary-container font-medium">Forgot Password?</button></div>
                <button type="submit" disabled={busy} className="w-full h-11 px-6 rounded-lg bg-gradient-to-r from-secondary to-primary text-on-primary text-sm font-medium tracking-wide flex items-center justify-center gap-2 shadow-sm hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-60"><span className="material-symbols-outlined text-[20px]">security</span>{busy ? 'Signing in...' : 'Sign In'}</button>
              </form>

             
              <div className="mt-8 pt-6 border-t border-surface-container"><div className="p-3.5 rounded-lg bg-surface-container-low flex items-start gap-3"><span className="material-symbols-outlined text-primary text-[20px] shrink-0">verified</span><p className="text-xs text-on-surface-variant leading-tight">SECURE AUTHENTICATION WITH HARDWARE-BASED SESSION PROTECTION.</p></div></div>
            </div>
          </section>
        </div>
      </main>

      <footer className="w-full bg-surface-container-low py-4 px-4 sm:px-6 lg:px-8 text-center text-[11px] text-on-surface-variant">© 2025 SENTINEL AI || SECURITY  DEVELOPED BY 
        <a href="https://www.facebook.com/cinanyag" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-container"> CINIFIX TECHNOLOGIES</a>
      </footer>

      {resetOpen ? (
        <div className="reset-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[#07131f]/60 px-4 py-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="reset-password-title" onMouseDown={(event) => { if (event.target === event.currentTarget) closeResetModal() }}>
          <section className="reset-modal-panel relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/60 bg-surface-container-lowest/95 p-6 shadow-[0_28px_90px_rgba(7,19,31,0.38)] ring-1 ring-primary/10">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4285f4] via-[#34a853] to-[#fbbc05]" />
            <button type="button" onClick={closeResetModal} disabled={resetBusy || gmailBusy || otpBusy} aria-label="Close password reset modal" className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-surface-container-low text-on-surface-variant shadow-[inset_3px_3px_8px_rgba(102,123,140,0.18),inset_-4px_-4px_10px_rgba(255,255,255,0.85)] transition hover:text-on-surface disabled:opacity-50">
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>

            <div className="mb-5 flex items-start gap-4 pr-12">
              <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-surface-container-low shadow-inner">
                <span className="font-display text-2xl font-bold text-[#4285f4]">G</span>
                {resetAuthenticated ? <span className="absolute -right-1 -bottom-1 grid h-6 w-6 place-items-center rounded-full bg-primary text-on-primary shadow-sm"><span className="material-symbols-outlined text-[16px]">done</span></span> : null}
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary">Gmail OTP authentication</p>
                <h2 id="reset-password-title" className="mt-1 font-display text-2xl font-bold tracking-tight text-[#0b1c30]">Verify recovery code</h2>
                <p className="mt-1 text-sm leading-5 text-on-surface-variant">Send a one-time password to the Gmail address in the users table.</p>
              </div>
            </div>

            <div className="mb-5 rounded-xl border border-white/60 bg-surface-container-low/80 p-4 shadow-[inset_4px_4px_12px_rgba(102,123,140,0.12),inset_-4px_-4px_12px_rgba(255,255,255,0.82)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white shadow-sm">
                    {gmailBusy || otpBusy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#4285f4] border-t-transparent" /> : <span className="font-display text-lg font-bold text-[#ea4335]">G</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">{resetAuthenticated ? 'OTP verified' : otpBusy ? 'Verifying OTP' : gmailBusy ? 'Sending OTP' : resetOtpSent ? 'OTP sent' : 'Secure Gmail OTP'}</p>
                    <p className="truncate text-sm font-semibold text-[#0b1c30]">{resetAccount?.email || resetEmail || 'Enter your Gmail address'}</p>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${resetAuthenticated ? 'bg-primary/10 text-primary' : resetOtpSent ? 'bg-[#4285f4]/10 text-[#2563eb]' : 'bg-surface text-on-surface-variant'}`}>{resetAuthenticated ? 'Verified' : resetOtpSent ? 'Sent' : 'Required'}</span>
              </div>
            </div>

            <form className="reset-modal-form space-y-4" onSubmit={handleResetPassword}>
              <label className="block space-y-1.5 text-sm font-medium text-on-surface">
                <span>Gmail address</span>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3.5 text-[20px] text-on-surface-variant pointer-events-none">alternate_email</span>
                  <input type="email" value={resetEmail} onChange={(event) => updateResetEmail(event.target.value)} autoComplete="username" className="h-12 w-full rounded-xl bg-surface pl-11 pr-4 text-sm shadow-inner transition-colors placeholder:text-on-surface-variant/50 focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/40" placeholder="admin@gmail.com" required />
                </div>
              </label>

              <button type="button" onClick={handleSendOtp} disabled={gmailBusy || otpBusy || resetBusy || !resetEmail.trim()} className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/70 bg-white text-sm font-semibold text-[#0b1c30] shadow-[0_14px_28px_rgba(20,41,58,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(20,41,58,0.16)] disabled:translate-y-0 disabled:opacity-65 disabled:shadow-sm">
                {gmailBusy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#4285f4] border-t-transparent" /> : <span className="grid h-6 w-6 place-items-center rounded-full bg-[#f8fbff] font-display text-sm font-bold text-[#4285f4] shadow-inner">G</span>}
                <span>{gmailBusy ? 'Sending premium OTP...' : resetOtpSent ? 'Resend OTP to Gmail' : 'Send OTP to Gmail'}</span>
              </button>

              <div className={`space-y-2 rounded-xl border border-white/60 bg-surface-container-low/70 p-3 transition ${resetOtpSent ? 'opacity-100' : 'pointer-events-none opacity-45'}`}>
                <label className="block space-y-1.5 text-sm font-medium text-on-surface">
                  <span>One-time password</span>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3.5 text-[20px] text-on-surface-variant pointer-events-none">password</span>
                    <input type="text" inputMode="numeric" maxLength={6} value={resetOtpCode} onChange={(event) => { setResetOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setResetAuthenticated(false); setResetError(''); setResetSuccess('') }} className="h-11 w-full rounded-lg bg-surface pl-11 pr-4 text-center font-mono text-lg font-semibold tracking-[0.35em] shadow-inner transition-colors placeholder:tracking-normal placeholder:text-sm placeholder:font-normal placeholder:text-on-surface-variant/50 focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="000000" disabled={!resetOtpSent || otpBusy || resetBusy} />
                  </div>
                </label>
                <button type="button" onClick={handleVerifyOtp} disabled={!resetOtpSent || resetOtpCode.length !== 6 || otpBusy || gmailBusy || resetBusy} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0b1c30] px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60">
                  {otpBusy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" /> : <span className="material-symbols-outlined text-[18px]">verified_user</span>}
                  <span>{otpBusy ? 'Verifying OTP...' : resetAuthenticated ? 'OTP verified' : 'Verify OTP'}</span>
                </button>
              </div>

              <div className={`space-y-4 transition ${resetAuthenticated ? 'opacity-100' : 'pointer-events-none opacity-45'}`}>
                <label className="block space-y-1.5 text-sm font-medium text-on-surface">
                  <span>New password</span>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3.5 text-[20px] text-on-surface-variant pointer-events-none">vpn_key</span>
                    <input type="password" value={resetNewPassword} onChange={(event) => { setResetNewPassword(event.target.value); setResetError(''); setResetSuccess('') }} autoComplete="new-password" minLength={4} disabled={!resetAuthenticated || resetBusy} className="h-11 w-full rounded-lg bg-surface pl-11 pr-4 text-sm shadow-inner transition-colors placeholder:text-on-surface-variant/50 focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed" placeholder="Enter new password" required />
                  </div>
                </label>

                <label className="block space-y-1.5 text-sm font-medium text-on-surface">
                  <span>Confirm password</span>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3.5 text-[20px] text-on-surface-variant pointer-events-none">lock_reset</span>
                    <input type="password" value={resetConfirmPassword} onChange={(event) => { setResetConfirmPassword(event.target.value); setResetError(''); setResetSuccess('') }} autoComplete="new-password" minLength={4} disabled={!resetAuthenticated || resetBusy} className="h-11 w-full rounded-lg bg-surface pl-11 pr-4 text-sm shadow-inner transition-colors placeholder:text-on-surface-variant/50 focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed" placeholder="Re-enter new password" required />
                  </div>
                </label>
              </div>

              {resetError ? <p role="alert" className="rounded-lg border border-error/25 bg-error-container px-3 py-2.5 text-xs font-medium text-on-error-container">{resetError}</p> : null}
              {resetSuccess ? <p role="status" className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-2.5 text-xs font-medium text-primary">{resetSuccess}</p> : null}

              <div className="flex items-center gap-3 pt-2">
                <button type="button" onClick={closeResetModal} disabled={resetBusy || gmailBusy || otpBusy} className="h-11 flex-1 rounded-lg border border-surface-container bg-surface-container-low px-4 text-sm font-medium text-on-surface-variant transition hover:text-on-surface disabled:opacity-60">Cancel</button>
                <button type="submit" disabled={resetBusy || gmailBusy || otpBusy || !resetAuthenticated} className="flex h-11 flex-[1.35] items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-secondary to-primary px-4 text-sm font-semibold text-on-primary shadow-sm transition hover:opacity-95 disabled:opacity-60">
                  {resetBusy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary/80 border-t-transparent" /> : null}
                  <span>{resetBusy ? 'Updating...' : 'Update password'}</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  )
}
