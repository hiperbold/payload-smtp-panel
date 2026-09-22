import type { Payload } from 'payload'
import { getRuntimeConfig } from '../registry.js'
import { nodemailerTransport } from '../transports/nodemailer.js'
import type { EmailConfig, SendEmailInput, SendEmailResult, Transport } from '../types.js'

export type SendEmailRuntimeOptions = {
  /** Overrides the transports registered by the plugin. Mainly for tests. */
  transports?: Transport[]
  /** Overrides `globalThis.fetch`. Mainly for tests. */
  fetch?: typeof globalThis.fetch
}

const DEFAULT_SLUG = 'email-settings'

/**
 * Sends an email using the plugin's global configuration. Reads the global
 * fresh on every call (with `overrideAccess: true` and
 * `context: { decryptSecrets: true }`) so admin panel changes apply on the
 * next send without a restart.
 */
export async function sendEmail(
  payload: Payload,
  input: SendEmailInput,
  runtime: SendEmailRuntimeOptions = {},
): Promise<SendEmailResult> {
  const slug = input.slug ?? DEFAULT_SLUG
  const transports = runtime.transports ?? getRuntimeConfig(slug)?.transports ?? [nodemailerTransport()]
  const fetchImpl = runtime.fetch ?? globalThis.fetch

  const config = (await payload.findGlobal({
    slug: slug as Parameters<Payload['findGlobal']>[0]['slug'],
    overrideAccess: true,
    context: { decryptSecrets: true },
  })) as unknown as EmailConfig

  const to = input.to || config?.defaultTo
  if (!to) {
    return { ok: false, error: 'No recipient: pass "to" or configure a default recipient in the panel.' }
  }

  if (!config?.enabled || !config?.host) {
    payload.logger.info(`[smtp-panel] sending disabled or incomplete, email not sent. To: ${to} | Subject: ${input.subject}`)
    return { ok: true, messageId: 'logged-only', skipped: 'disabled' }
  }

  const transport = transports.find((candidate) => candidate.matches(config))
  if (!transport) {
    const error = 'No transport matches the current configuration.'
    payload.logger.error(`[smtp-panel] ${error}`)
    return { ok: false, error }
  }

  // The panel bcc applies to every send unless skipped or equal to the
  // recipient; an explicit `input.bcc` always wins.
  const panelBcc = !input.skipDefaultBcc && config?.bcc && config.bcc !== to ? config.bcc : undefined
  const bcc = input.bcc || panelBcc

  // Without a sender the provider rejects the message with its own opaque
  // error, so fail here with something the panel can act on.
  if (!config?.fromEmail) {
    const error = 'No sender: fill in the sender email address in the panel.'
    payload.logger.error(`[smtp-panel] ${error}`)
    return { ok: false, error }
  }

  const from = `${config.fromName || config.fromEmail} <${config.fromEmail}>`

  try {
    const result = await transport.send(
      config,
      {
        from,
        to,
        bcc,
        replyTo: input.replyTo || config?.replyTo || undefined,
        subject: input.subject,
        text: input.text,
        html: input.html,
        attachments: input.attachments,
      },
      { logger: payload.logger, fetch: fetchImpl },
    )
    return { ok: true, messageId: result.messageId }
  } catch (err: any) {
    const error = err?.message || String(err)
    payload.logger.error(`[smtp-panel] failed to send to ${to} via ${transport.name}: ${error}`)
    return { ok: false, error }
  }
}
