import type { Field } from 'payload'
import { decryptSecret, encryptSecret } from '../utilities/crypto.js'

export type BuildPasswordFieldArgs = {
  slug: string
  encryptionKey: string
}

/**
 * The `pass` field. Encrypts the value with AES-256-GCM before storing it and
 * never returns the plaintext secret, unless `context.decryptSecrets` asks.
 *
 * When `beforeChange` receives an empty value (an admin saving some other
 * change without retyping the password) the current secret has to be kept. It
 * is read raw from the database through `req.payload.db.findGlobal`, NEVER
 * from `originalDoc`: `originalDoc` has already gone through the `afterRead`
 * hook below, which masks the value to `''`, so using it wipes the stored
 * secret on every save. That bug took email sending down on a live site, and
 * it is why this package ships a dedicated regression test for it (see
 * tests/passwordField.test.ts).
 */
export function buildPasswordField({ slug, encryptionKey }: BuildPasswordFieldArgs): Field {
  return {
    name: 'pass',
    type: 'text',
    label: { en: 'Password', pt: 'Senha' },
    admin: {
      description: {
        en: 'Encrypted in the database. Leave blank to keep the current password when saving other changes.',
        pt: 'Cifrada no banco. Deixe em branco para manter a senha atual ao salvar outras alterações.',
      },
      condition: (data) => data?.authEnabled !== false,
      style: { WebkitTextSecurity: 'disc' } as Record<string, unknown>,
    },
    hooks: {
      beforeChange: [
        async ({ value, req }) => {
          if (value === undefined || value === null || value === '') {
            const raw = (await req.payload.db.findGlobal({ slug, req })) as { pass?: string } | null
            return raw?.pass ?? ''
          }
          return encryptSecret(String(value), encryptionKey)
        },
      ],
      afterRead: [
        ({ value, req }) => {
          const decryptSecrets = (req?.context as Record<string, unknown> | undefined)?.decryptSecrets === true
          if (decryptSecrets) {
            return value ? decryptSecret(String(value), encryptionKey) : ''
          }
          return ''
        },
      ],
    },
  }
}
