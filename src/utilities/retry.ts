import type { SmtpLogger } from '../types.js'

export type PostJsonWithRetryArgs = {
  url: string
  headers: Record<string, string>
  body: unknown
  fetch: typeof globalThis.fetch
  logger?: SmtpLogger
  /** Used in log/error messages, defaults to `url`. */
  label?: string
}

export type PostJsonWithRetryResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string }

/** Waits before each attempt: no wait, then 1s, then 3s. */
const RETRY_DELAYS_MS = [0, 1_000, 3_000]
const TIMEOUT_MS = 15_000

/**
 * POSTs a JSON body with up to 3 attempts, retrying only on network errors,
 * HTTP 429 and 5xx. 4xx is not retried. Each attempt has a 15s timeout via
 * `AbortSignal.timeout`.
 */
export async function postJsonWithRetry(args: PostJsonWithRetryArgs): Promise<PostJsonWithRetryResult> {
  const { url, headers, body, fetch: fetchImpl, logger, label = url } = args
  let lastError = 'Unknown error'

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    const delay = RETRY_DELAYS_MS[attempt] ?? 0
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay))
    }

    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })

      const data: any = await response.json().catch(() => ({}))
      if (response.ok) {
        return { ok: true, data }
      }

      lastError = `${label} ${response.status}: ${data?.message || data?.error || response.statusText}`
      const retryable = response.status === 429 || response.status >= 500
      if (!retryable) break
    } catch (err: any) {
      lastError = err?.name === 'TimeoutError' ? `${label} did not respond within ${TIMEOUT_MS / 1000}s` : err?.message || String(err)
    }

    logger?.warn(`[smtp-panel] attempt ${attempt + 1} failed for ${label}: ${lastError}`)
  }

  return { ok: false, error: lastError }
}
