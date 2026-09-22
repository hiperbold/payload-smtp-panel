'use client'

import { useState } from 'react'

export type TestEmailButtonProps = {
  /** Slug of the plugin's global, passed in via `clientProps` by the field config. */
  slug?: string
}

type Status = 'idle' | 'sending' | 'ok' | 'error'

/**
 * "Send test email" button for the Test tab of the SMTP panel global.
 * Sends its own recipient address to `POST /api/<slug>/test` and reports
 * the result inline. Kept free of any admin-UI-specific dependency so the
 * `./client` export only needs `react`.
 */
export function TestEmailButton(props: TestEmailButtonProps = {}) {
  const slug = props.slug ?? 'email-settings'
  const [to, setTo] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  const send = async () => {
    setStatus('sending')
    setMessage('')
    try {
      const res = await fetch(`/api/${slug}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to || undefined }),
        credentials: 'include',
      })
      const data = await res.json()
      if (data.ok) {
        setStatus('ok')
        setMessage(
          data.skipped === 'disabled'
            ? 'Sending is disabled: the email was only logged on the server (not sent).'
            : `Test email sent successfully${to ? ` to ${to}` : ''} (id: ${data.messageId}).`,
        )
      } else {
        setStatus('error')
        setMessage(data.error || 'Failed to send.')
      }
    } catch (err: any) {
      setStatus('error')
      setMessage(err?.message || 'Network error.')
    }
  }

  const color = status === 'ok' ? '#1a7f37' : status === 'error' ? '#b42318' : 'inherit'

  return (
    <div style={{ marginTop: 8 }}>
      <input
        type="email"
        placeholder="test@example.com"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        style={{ marginRight: 8, padding: '4px 8px' }}
      />
      <button type="button" onClick={send} disabled={status === 'sending'} style={{ cursor: status === 'sending' ? 'wait' : 'pointer' }}>
        {status === 'sending' ? 'Sending…' : 'Send test email'}
      </button>
      {message && <p style={{ marginTop: 10, fontSize: 13, color, lineHeight: 1.4 }}>{message}</p>}
    </div>
  )
}
