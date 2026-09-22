# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0]

### Added

- `smtpPanelPlugin` for Payload 3: adds an `email-settings` global (configurable
  slug) with Sender, Connection, and Test tabs, editable from the admin panel.
- Required `access` option (`{ read, update }`), with no default, controlling who
  can read and update the email settings global.
- `defaults`, `group`, `encryptionKey`, `defaultBcc`, `testEndpoint`, and
  `useAsPayloadEmailAdapter` plugin options.
- `sendEmail(payload, options)` helper: reads the global with
  `overrideAccess: true` and `context: { decryptSecrets: true }`, never throws,
  returns `{ ok: true, messageId, skipped? }` or `{ ok: false, error }`.
- Default BCC support on the panel, applied to every send unless
  `skipDefaultBcc` is set, and never duplicated when equal to the recipient.
- `nodemailerTransport()`: traditional SMTP transport, `secure: true` on port
  465, `requireTLS: true` on `encryption: 'tls'`, optional authentication.
- `sendkitTransport()`: HTTPS API transport for SendKit, matched by host.
- `resendTransport()`: HTTPS API transport for Resend, matched by host.
- `Transport` type for custom transports, with `matches`, `send`, and a shared
  `postJsonWithRetry` helper (15s timeout per attempt, up to 3 attempts,
  retries on network errors, 429, and 5xx, not on 4xx).
- AES-256-GCM encryption for the `pass` field, key derived with scrypt from
  `encryptionKey` (default `payload.secret`), stored as
  `v1:<iv>:<tag>:<ciphertext>` in base64.
- `afterRead` masking of the `pass` field, revealed only with
  `context.decryptSecrets: true`.
- `beforeChange` handling that preserves the current encrypted secret when the
  field is submitted empty, reading it from the raw database record instead of
  `originalDoc`.
- Test endpoint `POST /api/<slug>/test`, guarded by the same `access.update` as
  the global, sending a fixed test message with `skipDefaultBcc: true`.
- `TestEmailButton` client component, exported from `./client`, registered on
  the Test tab when `testEndpoint` is enabled.
- Optional wiring into Payload's own `email` adapter via
  `useAsPayloadEmailAdapter`, for core Payload emails.
