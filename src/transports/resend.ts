import type { EmailConfig, OutgoingMessage, Transport, TransportContext } from '../types.js'
import { postJsonWithRetry } from '../utilities/retry.js'

const RESEND_API_URL = 'https://api.resend.com/emails'
const RESEND_HOST_RE = /(^|\.)resend\.com$/i

function buildBody(message: OutgoingMessage): Record<string, unknown> {
  const body: Record<string, unknown> = {
    from: message.from,
    to: message.to,
    subject: message.subject,
    ...(message.html ? { html: message.html } : {}),
    ...(message.text ? { text: message.text } : {}),
    ...(message.replyTo ? { reply_to: [message.replyTo] } : {}),
    ...(message.bcc ? { bcc: [message.bcc] } : {}),
  }

  if (message.attachments?.length) {
    body.attachments = message.attachments.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content.toString('base64'),
      ...(attachment.contentType ? { content_type: attachment.contentType } : {}),
    }))
  }

  return body
}

/**
 * Resend HTTPS API transport (https://resend.com/docs/api-reference/emails).
 * Matches any host on the `resend.com` domain. The panel's `pass` field
 * holds the API key. Same request shape as the SendKit transport.
 */
export function resendTransport(): Transport {
  return {
    name: 'resend',
    matches: (config: EmailConfig) => RESEND_HOST_RE.test(String(config.host ?? '')),
    async send(config: EmailConfig, message: OutgoingMessage, ctx: TransportContext) {
      const result = await postJsonWithRetry({
        url: RESEND_API_URL,
        headers: { Authorization: `Bearer ${config.pass ?? ''}` },
        body: buildBody(message),
        fetch: ctx.fetch,
        logger: ctx.logger,
        label: 'Resend',
      })

      if (!result.ok) {
        throw new Error(result.error)
      }

      const data = result.data as { id?: string; data?: Array<{ id?: string }> } | undefined
      const messageId = data?.id || data?.data?.[0]?.id || 'resend-no-id'
      ctx.logger.info(`[smtp-panel] email sent to ${message.to} via Resend (id: ${messageId})`)
      return { messageId }
    },
  }
}
