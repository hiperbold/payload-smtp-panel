import type { Endpoint, PayloadRequest } from 'payload'
import { sendEmail } from '../utilities/sendEmail.js'
import type { SmtpPanelPluginOptions } from '../types.js'

/**
 * `POST /api/<slug>/test`: sends a test email using the panel's current
 * configuration. Restricted to whoever passes the same `access.update` used
 * by the global, since sending is the same privilege as changing where the
 * site's email goes.
 */
export function buildTestEndpoint(options: SmtpPanelPluginOptions): Endpoint {
  const slug = options.slug ?? 'email-settings'

  return {
    path: `/${slug}/test`,
    method: 'post',
    handler: async (req: PayloadRequest): Promise<Response> => {
      const authorized = await options.access.update({ req })
      if (authorized !== true) {
        return Response.json({ ok: false, error: 'Not authorized.' }, { status: 403 })
      }

      let to: string | undefined
      try {
        const body = (await req.json?.()) as { to?: string } | undefined
        to = body?.to?.trim() || undefined
      } catch {
        // body is optional
      }

      const result = await sendEmail(req.payload, {
        to,
        subject: 'SMTP test email',
        text: 'This is a test email sent from the admin panel. If you received it, your email configuration is working.',
        html: '<p>This is a test email sent from the admin panel. If you received it, your email configuration is working.</p>',
        skipDefaultBcc: true,
        slug,
      })

      if (!result.ok) {
        return Response.json({ ok: false, error: result.error }, { status: 502 })
      }

      return Response.json({ ok: true, messageId: result.messageId, skipped: result.skipped })
    },
  }
}
