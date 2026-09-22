import nodemailer from 'nodemailer'
import type { EmailConfig, OutgoingMessage, Transport, TransportContext } from '../types.js'

/**
 * Plain SMTP transport via nodemailer. Always matches, so it must be added
 * last in the transport list (the plugin does this automatically).
 */
export function nodemailerTransport(): Transport {
  return {
    name: 'nodemailer',
    matches: () => true,
    async send(config: EmailConfig, message: OutgoingMessage, ctx: TransportContext) {
      const secure = config.encryption === 'ssl' // 465 = direct SSL; 587/STARTTLS = secure:false + requireTLS
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port || (secure ? 465 : 587),
        secure,
        requireTLS: config.encryption === 'tls',
        auth: config.authEnabled && config.user ? { user: config.user, pass: config.pass } : undefined,
      })

      const info = await transporter.sendMail({
        from: message.from,
        to: message.to,
        bcc: message.bcc,
        replyTo: message.replyTo,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments,
      })

      ctx.logger.info(`[smtp-panel] email sent to ${message.to} via nodemailer (id: ${info.messageId})`)
      return { messageId: info.messageId }
    },
  }
}
