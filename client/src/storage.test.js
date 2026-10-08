import assert from 'node:assert/strict'
import { test } from 'node:test'

function storage() {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  }
}

test('demo credentials and session lifecycle across browser storage restrictions', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  const sessionKey = 'sentinel-client:session'
  try {
    for (const blocked of [[], ['localStorage'], ['sessionStorage'], ['localStorage', 'sessionStorage']]) {
      const browser = {}
      for (const name of ['localStorage', 'sessionStorage']) {
        const value = storage()
        Object.defineProperty(browser, name, { get() {
          if (blocked.includes(name)) throw new Error('Storage blocked')
          return value
        } })
      }
      Object.defineProperty(globalThis, 'window', { configurable: true, value: browser })
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => browser.localStorage })
      Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined })
      const auth = await import(`./storage.js?blocked=${blocked.join(',')}`)
      assert.equal(auth.signedIn(), false)
      assert.equal(await auth.matchesDemoPassword('admin123'), true)
      assert.equal(await auth.matchesDemoPassword('wrong'), false)
      for (const remember of [true, false]) {
        auth.startSession(remember)
        assert.equal(auth.signedIn(), true)
        if (!blocked.includes('localStorage')) {
          assert.equal(browser.localStorage.getItem(sessionKey), remember ? 'true' : null)
        }
        auth.endSession()
        assert.equal(auth.signedIn(), false)
      }
      if (!blocked.includes('localStorage')) {
        browser.localStorage.setItem('sentinel-client:password', JSON.stringify('custom-digest'))
        await assert.rejects(auth.matchesDemoPassword('admin123'), /HTTPS or localhost/)
      }
    }
  } finally {
    for (const [name, descriptor] of [['window', originalWindow], ['localStorage', originalStorage], ['crypto', originalCrypto]]) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  }
})
