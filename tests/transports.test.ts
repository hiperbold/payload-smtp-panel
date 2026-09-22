import { describe, expect, it } from 'vitest'
import { sendkitTransport } from '../src/transports/sendkit.js'
import type { EmailConfig, OutgoingMessage } from '../src/types.js'

const CONFIG: EmailConfig = {
  enabled: true,
  fromName: 'Acme',
  fromEmail: 'no-reply@example.com',
  host: 'smtp.sendkit.dev',
  port: 465,
  encryption: 'ssl',
  authEnabled: true,
  pass: 'test-key',
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('sendkitTransport', () => {
  it('matches sendkit.dev hosts and subdomains only', () => {
    const transport = sendkitTransport()
    expect(transport.matches({ ...CONFIG, host: 'smtp.sendkit.dev' })).toBe(true)
    expect(transport.matches({ ...CONFIG, host: 'sendkit.dev' })).toBe(true)
    expect(transport.matches({ ...CONFIG, host: 'smtp.example.com' })).toBe(false)
    expect(transport.matches({ ...CONFIG, host: undefined })).toBe(false)
  })

  it('sends the correct body (recipient, bcc, reply_to, base64 attachment) and Authorization header', async () => {
    const transport = sendkitTransport()
    let capturedUrl = ''
    let capturedInit: RequestInit | undefined

    const fetchStub = (async (url: string | URL, init?: RequestInit) => {
      capturedUrl = String(url)
      capturedInit = init
      return jsonResponse(200, { id: 'sendkit-msg-1' })
    }) as unknown as typeof globalThis.fetch

    const message: OutgoingMessage = {
      from: 'Acme <no-reply@example.com>',
      to: 'lead@example.com',
      bcc: 'archive@example.com',
      replyTo: 'sales@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi',
      attachments: [{ filename: 'resume.pdf', content: Buffer.from('pdf-bytes'), contentType: 'application/pdf' }],
    }

    const result = await transport.send(CONFIG, message, { logger: { info() {}, warn() {}, error() {} }, fetch: fetchStub })

    expect(result).toEqual({ messageId: 'sendkit-msg-1' })
    expect(capturedUrl).toBe('https://api.sendkit.dev/emails')

    const headers = capturedInit?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer test-key')

    const body = JSON.parse(String(capturedInit?.body))
    expect(body.to).toBe('lead@example.com')
    expect(body.bcc).toEqual(['archive@example.com'])
    expect(body.reply_to).toEqual(['sales@example.com'])
    expect(body.attachments).toEqual([
      { filename: 'resume.pdf', content: Buffer.from('pdf-bytes').toString('base64'), content_type: 'application/pdf' },
    ])
  })

  it('throws when the request ultimately fails, so sendEmail can turn it into ok:false', async () => {
    const transport = sendkitTransport()
    const fetchStub = (async () => jsonResponse(400, { message: 'invalid request' })) as unknown as typeof globalThis.fetch

    const message: OutgoingMessage = {
      from: 'Acme <no-reply@example.com>',
      to: 'lead@example.com',
      subject: 'Hello',
      text: 'Hi',
    }

    await expect(
      transport.send(CONFIG, message, { logger: { info() {}, warn() {}, error() {} }, fetch: fetchStub }),
    ).rejects.toThrow(/400/)
  })
})
