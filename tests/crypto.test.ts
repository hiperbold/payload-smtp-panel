import { describe, expect, it } from 'vitest'
import { decryptSecret, encryptSecret, isEncrypted } from '../src/utilities/crypto.js'

const SECRET = 'test-encryption-key'

describe('crypto', () => {
  it('encrypts a secret and decrypt returns the original value', () => {
    const encrypted = encryptSecret('super-secret-password', SECRET)

    expect(encrypted).not.toBe('super-secret-password')
    expect(isEncrypted(encrypted)).toBe(true)
    expect(encrypted.startsWith('pspv1:')).toBe(true)

    const decrypted = decryptSecret(encrypted, SECRET)
    expect(decrypted).toBe('super-secret-password')
  })

  it('returns an unrecognized-prefix value unchanged (legacy/plaintext compatibility)', () => {
    expect(decryptSecret('plain-legacy-value', SECRET)).toBe('plain-legacy-value')
  })

  it('returns empty string for empty input', () => {
    expect(encryptSecret('', SECRET)).toBe('')
    expect(decryptSecret('', SECRET)).toBe('')
  })

  it('is idempotent: encrypting an already-encrypted value returns it unchanged', () => {
    const once = encryptSecret('another-secret', SECRET)
    const twice = encryptSecret(once, SECRET)
    expect(twice).toBe(once)
  })
})
