import { useState } from 'react'
import { clearSession, getSession, saveSession } from './api'

export function readSaved(key, fallback) {
  try { return JSON.parse(localStorage.getItem(`sentinel-client:${key}`)) ?? fallback }
  catch { return fallback }
}

export function useSaved(key, fallback) {
  const [value, setValue] = useState(() => readSaved(key, fallback))
  function save(next) {
    localStorage.setItem(`sentinel-client:${key}`, JSON.stringify(next))
    setValue(next)
  }
  return [value, save]
}

const sessionKey = 'sentinel-client:session'
let temporarySession = null

function sessionStorageAction(name, action) {
  try { return action(window[name]) }
  catch { return false }
}

export function startSession(remember) {
  endSession()
  const names = remember ? ['localStorage', 'sessionStorage'] : ['sessionStorage']
  const saved = names.some(name => sessionStorageAction(name, storage => {
    storage.setItem(sessionKey, 'true')
    return storage.getItem(sessionKey) === 'true'
  }))
  // A blocked storage API must not prevent access to this local demo.
  temporarySession = saved ? null : true
}

export function startBackendSession(session, remember) {
  saveSession(session, remember)
  temporarySession = null
}

export function endSession() {
  temporarySession = false
  clearSession()
  for (const name of ['localStorage', 'sessionStorage']) {
    sessionStorageAction(name, storage => storage.removeItem(sessionKey))
  }
}

export function signedIn() {
  const session = getSession()
  if (session?.role === 'USER') return true
  if (session?.role && session.role !== 'USER') {
    clearSession()
    return false
  }
  if (temporarySession !== null) return temporarySession
  return ['localStorage', 'sessionStorage'].some(name =>
    sessionStorageAction(name, storage => storage.getItem(sessionKey) === 'true'))
}

export async function matchesDemoPassword(value) {
  const saved = readSaved('password', null)
  if (!saved) return value === 'admin123'
  if (!globalThis.crypto?.subtle) {
    throw new Error('Use HTTPS or localhost to sign in with your changed demo password.')
  }
  return await passwordDigest(value) === saved
}

export async function passwordDigest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}
