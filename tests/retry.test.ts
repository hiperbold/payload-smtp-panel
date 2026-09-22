import { describe, expect, it } from 'vitest'
import { postJsonWithRetry } from '../src/utilities/retry.js'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('postJsonWithRetry', () => {
  it('retries a 500 once and succeeds on the second attempt (two calls total)', async () => {
    let calls = 0
    const fetchStub = (async () => {
      calls += 1
      if (calls === 1) return jsonResponse(500, { message: 'server error' })
      return jsonResponse(200, { id: 'msg-1' })
    }) as unknown as typeof globalThis.fetch

    const result = await postJsonWithRetry({
      url: 'https://api.example.com/emails',
      headers: { Authorization: 'Bearer test-key' },
      body: { hello: 'world' },
      fetch: fetchStub,
    })

    expect(calls).toBe(2)
    expect(result).toEqual({ ok: true, data: { id: 'msg-1' } })
  }, 10_000)

  it('does not retry a 400 (one call total)', async () => {
    let calls = 0
    const fetchStub = (async () => {
      calls += 1
      return jsonResponse(400, { message: 'bad request' })
    }) as unknown as typeof globalThis.fetch

    const result = await postJsonWithRetry({
      url: 'https://api.example.com/emails',
      headers: { Authorization: 'Bearer test-key' },
      body: { hello: 'world' },
      fetch: fetchStub,
    })

    expect(calls).toBe(1)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('400')
    }
  }, 10_000)

  it('exhausts all 3 attempts on a network error and returns ok:false', async () => {
    let calls = 0
    const fetchStub = (async () => {
      calls += 1
      throw new Error('network down')
    }) as unknown as typeof globalThis.fetch

    const result = await postJsonWithRetry({
      url: 'https://api.example.com/emails',
      headers: { Authorization: 'Bearer test-key' },
      body: { hello: 'world' },
      fetch: fetchStub,
    })

    expect(calls).toBe(3)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('network down')
    }
  }, 10_000)
})
