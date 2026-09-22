import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

/**
 * AES-256-GCM encryption for the SMTP secret stored in the database. The
 * key is derived (scrypt) from the plugin's `encryptionKey` option, which
 * defaults to the Payload config `secret`.
 *
 * Stored format: `pspv1:<iv>:<authTag>:<ciphertext>`, each part base64.
 * `decryptSecret` returns the value unchanged when it does not recognize
 * this prefix, so a plaintext legacy value is not corrupted.
 */

// Deliberately distinctive: a stored secret is treated as already encrypted
// when it starts with this prefix, and a real provider key must never collide
// with it by accident.
const VERSION_PREFIX = 'pspv1'
const SALT = 'payload-smtp-panel'
const KEY_LENGTH = 32
const IV_LENGTH = 12

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, SALT, KEY_LENGTH)
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(`${VERSION_PREFIX}:`)
}

export function encryptSecret(plain: string, secret: string): string {
  if (!plain) return ''
  if (isEncrypted(plain)) return plain // idempotent

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [VERSION_PREFIX, iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':')
}

export function decryptSecret(value: string, secret: string): string {
  if (!value) return ''
  if (!isEncrypted(value)) return value // legacy/plaintext value, or nothing to decrypt

  const [, ivB64, authTagB64, dataB64] = value.split(':')
  if (!ivB64 || !authTagB64 || !dataB64) return value

  const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'))
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()])

  return decrypted.toString('utf8')
}
