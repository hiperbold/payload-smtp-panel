import { describe, expect, it, vi } from 'vitest'
import { sendEmail } from '../src/utilities/sendEmail.js'
import type { EmailConfig, OutgoingMessage, Transport, TransportContext } from '../src/types.js'
import { createPayloadDouble } from './helpers/payloadDouble.js'

const BASE_CONFIG: EmailConfig = {
  enabled: true,
  fromName: 'Acme',
  fromEmail: 'no-reply@example.com',
  host: 'smtp.example.com',
  port: 465,
  encryption: 'ssl',
  authEnabled: true,
  user: 'smtp-user',
  pass: 'smtp-pass',
}

function fakeTransport(name: string, matches: (config: EmailConfig) => boolean): Transport & { calls: OutgoingMessage[] } {
  const calls: OutgoingMessage[] = []
  return {
    name,
    matches,
    calls,
    async send(_config: EmailConfig, message: OutgoingMessage, _ctx: TransportContext) {
      calls.push(message)
      return { messageId: `${name}-id` }
    },
  }
}

describe('sendEmail', () => {
  it('does not call any transport and returns skipped:"disabled" when enabled is false', async () => {
    const { payload } = createPayloadDouble({ ...BASE_CONFIG, enabled: false, defaultTo: 'someone@example.com' })
    const transport = fakeTransport('spy', () => true)

    const result = await sendEmail(payload, { subject: 'Hello' }, { transports: [transport] })

    expect(result).toEqual({ ok: true, messageId: 'logged-only', skipped: 'disabled' })
    expect(transport.calls).toHaveLength(0)
  })

  it('does not call any transport and returns skipped:"disabled" when host is empty', async () => {
    const { payload } = createPayloadDouble({ ...BASE_CONFIG, host: '', defaultTo: 'someone@example.com' })
    const transport = fakeTransport('spy', () => true)

    const result = await sendEmail(payload, { subject: 'Hello' }, { transports: [transport] })

    expect(result.ok).toBe(true)
    expect((result as { skipped?: string }).skipped).toBe('disabled')
    expect(transport.calls).toHaveLength(0)
  })

  it('fails with a readable error when no sender address is configured', async () => {
    const { payload } = createPayloadDouble({ ...BASE_CONFIG, fromEmail: undefined })
    const transport = fakeTransport('spy', () => true)

    const result = await sendEmail(payload, { to: 'lead@example.com', subject: 'Hello' }, { transports: [transport] })

    expect(result.ok).toBe(false)
    expect((result as { error: string }).error).toMatch(/sender/i)
    expect(transport.calls).toHaveLength(0)
  })

  it('routes to the transport that matches the configured host', async () => {
    const { payload } = createPayloadDouble({ ...BASE_CONFIG, host: 'smtp.sendkit.dev' })
    const sendkitLike = fakeTransport('sendkit-fake', (config) => /sendkit\.dev$/.test(config.host ?? ''))
    const generic = fakeTransport('generic-fake', () => true)

    const result = await sendEmail(
      payload,
      { to: 'lead@example.com', subject: 'Hello' },
      { transports: [sendkitLike, generic] },
    )

    expect(result.ok).toBe(true)
    expect(sendkitLike.calls).toHaveLength(1)
    expect(generic.calls).toHaveLength(0)
  })

  it('falls through to a generic transport when no specific transport matches the host', async () => {
    const { payload } = createPayloadDouble({ ...BASE_CONFIG, host: 'smtp.example.com' })
    const sendkitLike = fakeTransport('sendkit-fake', (config) => /sendkit\.dev$/.test(config.host ?? ''))
    const generic = fakeTransport('generic-fake', () => true)

    const result = await sendEmail(
      payload,
      { to: 'lead@example.com', subject: 'Hello' },
      { transports: [sendkitLike, generic] },
    )

    expect(result.ok).toBe(true)
    expect(sendkitLike.calls).toHaveLength(0)
    expect(generic.calls).toHaveLength(1)
  })

  it('respects transport order: the first matching transport in the list wins', async () => {
    const { payload } = createPayloadDouble({ ...BASE_CONFIG })
    const first = fakeTransport('first', () => true)
    const second = fakeTransport('second', () => true)

    const result = await sendEmail(payload, { to: 'lead@example.com', subject: 'Hello' }, { transports: [first, second] })

    expect(result).toMatchObject({ ok: true, messageId: 'first-id' })
    expect(first.calls).toHaveLength(1)
    expect(second.calls).toHaveLength(0)
  })

  it('applies the panel bcc by default', async () => {
    const { payload } = createPayloadDouble({ ...BASE_CONFIG, bcc: 'archive@example.com' })
    const transport = fakeTransport('spy', () => true)

    await sendEmail(payload, { to: 'lead@example.com', subject: 'Hello' }, { transports: [transport] })

    expect(transport.calls[0]?.bcc).toBe('archive@example.com')
  })

  it('does not apply the panel bcc when skipDefaultBcc is true', async () => {
    const { payload } = createPayloadDouble({ ...BASE_CONFIG, bcc: 'archive@example.com' })
    const transport = fakeTransport('spy', () => true)

    await sendEmail(
      payload,
      { to: 'lead@example.com', subject: 'Hello', skipDefaultBcc: true },
      { transports: [transport] },
    )

    expect(transport.calls[0]?.bcc).toBeUndefined()
  })

  it('does not repeat the bcc when it is the same as the recipient', async () => {
    const { payload } = createPayloadDouble({ ...BASE_CONFIG, bcc: 'lead@example.com' })
    const transport = fakeTransport('spy', () => true)

    await sendEmail(payload, { to: 'lead@example.com', subject: 'Hello' }, { transports: [transport] })

    expect(transport.calls[0]?.bcc).toBeUndefined()
  })

  it('returns ok:false and calls no transport when there is no recipient at all', async () => {
    const { payload } = createPayloadDouble({ ...BASE_CONFIG, defaultTo: undefined })
    const transport = fakeTransport('spy', () => true)

    const result = await sendEmail(payload, { subject: 'Hello' }, { transports: [transport] })

    expect(result.ok).toBe(false)
    expect(transport.calls).toHaveLength(0)
  })

  it('uses the configured default recipient when "to" is omitted', async () => {
    const { payload } = createPayloadDouble({ ...BASE_CONFIG, defaultTo: 'default@example.com' })
    const transport = fakeTransport('spy', () => true)

    await sendEmail(payload, { subject: 'Hello' }, { transports: [transport] })

    expect(transport.calls[0]?.to).toBe('default@example.com')
  })

  it('propagates a transport failure as ok:false with the error message', async () => {
    const { payload } = createPayloadDouble({ ...BASE_CONFIG })
    const failing: Transport = {
      name: 'failing',
      matches: () => true,
      send: vi.fn().mockRejectedValue(new Error('boom')),
    }

    const result = await sendEmail(payload, { to: 'lead@example.com', subject: 'Hello' }, { transports: [failing] })

    expect(result).toEqual({ ok: false, error: 'boom' })
  })
})
