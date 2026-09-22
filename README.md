# @hiperbold/payload-smtp-panel

Email sending configuration for Payload 3, editable from the admin panel, with an encrypted secret, traditional SMTP, and HTTPS API transports.

## Why this exists

Payload's native email adapter is configured in code and environment variables. It serves the core emails (password reset, email verification) and only changes with a new deploy. This plugin adds a global in the admin panel where the client can change the recipient, the sender, or the email provider without publishing the site again.

## Install

```bash
pnpm add @hiperbold/payload-smtp-panel
```

```bash
npm install @hiperbold/payload-smtp-panel
```

Minimal `payload.config.ts`:

```ts
import { buildConfig } from 'payload'
import { smtpPanelPlugin } from '@hiperbold/payload-smtp-panel'

export default buildConfig({
  plugins: [
    smtpPanelPlugin({
      access: {
        // Only administrators: whoever edits this screen decides where the emails go.
        read: ({ req: { user } }) => Boolean(user?.roles?.includes('admin')),
        update: ({ req: { user } }) => Boolean(user?.roles?.includes('admin')),
      },
    }),
  ],
})
```

`access` is required by the type, on purpose. Whoever can edit this screen decides where the site's emails go. There is no default: you must define it explicitly.

## Usage

Call `sendEmail` from a form route or any server code that needs to send mail:

```ts
import { sendEmail } from '@hiperbold/payload-smtp-panel'

const result = await sendEmail(payload, {
  to: 'user@example.com',
  subject: 'New message',
  text: 'Someone submitted the contact form.',
})

if (!result.ok) {
  payload.logger.error(result.error)
}
```

Return contract:

```ts
{ ok: true, messageId: string, skipped?: 'disabled' } | { ok: false, error: string }
```

`sendEmail` never throws. If the email settings global has `enabled: false` or no `host`, it logs and returns `{ ok: true, messageId: 'logged-only', skipped: 'disabled' }`. If there is no recipient at all, it returns `{ ok: false, error }`. A form submission should never break because email sending failed.

## Plugin options

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `access` | `{ read, update }` | none, required | Payload access control for the email settings global. Required because this screen controls where the site's emails go. |
| `slug` | `string` | `'email-settings'` | Slug of the global created by the plugin. |
| `group` | `string` | `'Settings'` | Admin UI group the global is listed under. |
| `defaults` | `Partial<EmailConfig>` | none | Initial values for fields such as `fromName`, `port`, `encryption`. |
| `transports` | `Transport[]` | none | Custom transports, tried in the order given, before the built-in nodemailer transport. |
| `encryptionKey` | `string` | `payload.secret` | Key used to derive the AES-256-GCM key that encrypts the `pass` field. |
| `defaultBcc` | `boolean` | `false` | Adds a `bcc` field to the panel, applied to every send. |
| `testEndpoint` | `boolean` | `true` | Enables the test route and the test button in the panel. |
| `useAsPayloadEmailAdapter` | `boolean` | `false` | Wires this configuration into Payload's own `email` adapter, for core emails. |

## Transports

Three transports ship with the plugin:

- **`nodemailerTransport()`**: the fallback. `matches` always returns true, so it is used last. Uses `secure: true` on port 465, `requireTLS: true` when `encryption === 'tls'`, and only authenticates when `authEnabled` and `user` are set.
- **`sendkitTransport()`**: matches when `host` is `sendkit.dev` or a subdomain of it. Sends a `POST` to `https://api.sendkit.dev/emails` with `Authorization: Bearer <pass>`.
- **`resendTransport()`**: matches when `host` is `resend.com` or a subdomain of it. Sends a `POST` to `https://api.resend.com/emails`, with the same general request shape as SendKit.

The transport is chosen by matching the configured `host` against each transport's `matches` function, in the order listed in the `transports` option, plus the built-in nodemailer transport at the end. HTTP transports share a `postJsonWithRetry` helper: 15 second timeout per attempt, up to 3 attempts with 0 / 1s / 3s waits, retrying only on network errors, 429, and 5xx. 4xx responses are not retried.

Example of a custom transport:

```ts
import type { Transport } from '@hiperbold/payload-smtp-panel'

// Matches a fictional provider by host and posts to its API.
// config.pass arrives already decrypted for this call.
const exampleTransport: Transport = {
  name: 'example-provider',
  matches: (config) => Boolean(config.host?.endsWith('example.com')),
  send: async (config, message, ctx) => {
    const response = await ctx.fetch('https://api.example.com/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.pass}` },
      body: JSON.stringify(message),
    })
    const data = await response.json()
    return { messageId: data.id }
  },
}
```

## Security

- The `pass` field is encrypted with AES-256-GCM before it is stored. The key is derived from `encryptionKey` (default `payload.secret`) with scrypt. The stored format is `pspv1:<iv>:<tag>:<ciphertext>`, base64 encoded.
- The field is always masked on read: `afterRead` returns `''` unless the request context has `decryptSecrets: true`. `sendEmail` reads the global with that context internally.
- `access` is required and controls both reading and updating this global. There is no default access control.
- If you change `encryptionKey`, previously encrypted secrets can no longer be decrypted with the new key. You will need to re-enter the password field in the panel after the change.

## Gotchas from production

**A masked secret in `afterRead` arrives empty in `originalDoc`.** Keeping the old password when the field is submitted empty in the panel requires reading the raw value from the database, not from `originalDoc`, because `originalDoc` has already passed through `afterRead` and is masked. Using `originalDoc` here wipes the stored password on every Save. This exact bug happened in production and is the main reason this package has its own regression test for it.

**Many VPS providers block outbound traffic on ports 25, 465, 587, and 2525.** The symptom is a timeout before authentication even starts, not an authentication error. To check from inside the server: `nc -zv -w 5 host 465`. This is the reason the plugin also ships HTTPS API transports: they use port 443, which is rarely blocked.

**Payload's own emails (password reset, email verification) only go out through this plugin if `useAsPayloadEmailAdapter` is enabled**, or if another email adapter is configured. Without one of the two, "forgot my password" in the admin panel sends nothing.

## Testing and development

```bash
pnpm install
pnpm test
pnpm build
pnpm typecheck
```

## License

MIT. See [LICENSE](./LICENSE).
