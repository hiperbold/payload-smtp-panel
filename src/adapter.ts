import type { Payload, PayloadEmailAdapter, SendEmailOptions } from 'payload'
import { sendEmail } from './utilities/sendEmail.js'

export type BuildEmailAdapterArgs = {
  slug: string
}

/**
 * Nodemailer's own address types vary across versions (plain string, an
 * `{ address }` object, or an array of either). Cast to `unknown` and read
 * defensively instead of depending on a specific shape.
 */
function firstAddress(value: unknown): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value
  if (!candidate) return undefined
  if (typeof candidate === 'string') return candidate
  const address = (candidate as { address?: unknown }).address
  return typeof address === 'string' ? address : undefined
}

/**
 * Wires this plugin's panel configuration as the Payload core email adapter
 * (`config.email`), so core emails (password reset, verification) go
 * through the same host/transport as the rest of the site.
 */
export function buildEmailAdapter({ slug }: BuildEmailAdapterArgs): PayloadEmailAdapter {
  return ({ payload }: { payload: Payload }) => ({
    name: 'smtp-panel',
    defaultFromAddress: 'no-reply@example.com',
    defaultFromName: 'Payload',
    sendEmail: async (message: SendEmailOptions) => {
      const to = firstAddress(message.to)
      const bcc = firstAddress(message.bcc)
      const replyTo = firstAddress(message.replyTo)

      const result = await sendEmail(payload, {
        to,
        subject: message.subject ?? '',
        text: typeof message.text === 'string' ? message.text : undefined,
        html: typeof message.html === 'string' ? message.html : undefined,
        replyTo,
        bcc,
        slug,
      })

      if (!result.ok) {
        throw new Error(result.error)
      }

      return result
    },
  })
}
