import type { TextField } from 'payload'
import { describe, expect, it } from 'vitest'
import { buildPasswordField } from '../src/fields/passwordField.js'
import { decryptSecret, encryptSecret } from '../src/utilities/crypto.js'

const SLUG = 'email-settings'
const ENCRYPTION_KEY = 'test-encryption-key'

function getHooks() {
  const field = buildPasswordField({ slug: SLUG, encryptionKey: ENCRYPTION_KEY }) as TextField
  const beforeChange = field.hooks?.beforeChange?.[0]
  const afterRead = field.hooks?.afterRead?.[0]
  if (!beforeChange || !afterRead) {
    throw new Error('password field is missing beforeChange/afterRead hooks')
  }
  return { beforeChange, afterRead }
}

describe('password field hooks', () => {
  // Regression test for the 2026-09-18 incident: saving the form without
  // typing a new password must NOT wipe the encrypted secret already in the
  // database. The fix reads the raw DB row (`req.payload.db.findGlobal`),
  // never `originalDoc` (which is already masked by `afterRead`).
  it('keeps the current encrypted secret when the value is empty on update (regression 2026-09-18)', async () => {
    const { beforeChange } = getHooks()
    const currentEncrypted = encryptSecret('current-api-key', ENCRYPTION_KEY)

    const findGlobal = async () => ({ pass: currentEncrypted })
    const req = { payload: { db: { findGlobal } } }

    const result = await (beforeChange as any)({ value: '', req })

    expect(result).toBe(currentEncrypted)
    expect(decryptSecret(result, ENCRYPTION_KEY)).toBe('current-api-key')
  })

  it('also keeps the current secret when the value is undefined or null', async () => {
    const { beforeChange } = getHooks()
    const currentEncrypted = encryptSecret('current-api-key', ENCRYPTION_KEY)
    const req = { payload: { db: { findGlobal: async () => ({ pass: currentEncrypted }) } } }

    expect(await (beforeChange as any)({ value: undefined, req })).toBe(currentEncrypted)
    expect(await (beforeChange as any)({ value: null, req })).toBe(currentEncrypted)
  })

  it('encrypts a new secret on write, and decryptSecret recovers the original', async () => {
    const { beforeChange } = getHooks()
    // The raw DB double must not be consulted at all when a new value is provided.
    const findGlobal = async () => {
      throw new Error('db.findGlobal should not be called when a new value is provided')
    }
    const req = { payload: { db: { findGlobal } } }

    const stored = await (beforeChange as any)({ value: 'brand-new-api-key', req })

    expect(stored).not.toBe('brand-new-api-key')
    expect(stored.startsWith('pspv1:')).toBe(true)
    expect(decryptSecret(stored, ENCRYPTION_KEY)).toBe('brand-new-api-key')
  })

  it('afterRead masks the secret by default', () => {
    const { afterRead } = getHooks()
    const encrypted = encryptSecret('current-api-key', ENCRYPTION_KEY)
    const req = { context: {} }

    const result = (afterRead as any)({ value: encrypted, req })

    expect(result).toBe('')
  })

  it('afterRead reveals the decrypted secret when context.decryptSecrets is true', () => {
    const { afterRead } = getHooks()
    const encrypted = encryptSecret('current-api-key', ENCRYPTION_KEY)
    const req = { context: { decryptSecrets: true } }

    const result = (afterRead as any)({ value: encrypted, req })

    expect(result).toBe('current-api-key')
  })

  it('afterRead returns empty string when there is no stored value, even with decryptSecrets', () => {
    const { afterRead } = getHooks()
    const req = { context: { decryptSecrets: true } }

    expect((afterRead as any)({ value: '', req })).toBe('')
    expect((afterRead as any)({ value: undefined, req })).toBe('')
  })
})
