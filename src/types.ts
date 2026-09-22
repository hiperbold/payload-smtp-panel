import type { Access } from 'payload'

export type EncryptionMode = 'ssl' | 'tls' | 'none'

/**
 * Resolved email configuration, as read from the plugin's global (with
 * secrets decrypted when `context.decryptSecrets` is set).
 */
export type EmailConfig = {
  enabled: boolean
  fromName?: string
  fromEmail?: string
  replyTo?: string
  defaultTo?: string
  bcc?: string
  host?: string
  port?: number
  encryption: EncryptionMode
  authEnabled: boolean
  user?: string
  pass?: string
}

export type EmailAttachment = {
  filename: string
  content: Buffer
  contentType?: string
}

/** Message shape handed to a transport, already resolved by `sendEmail`. */
export type OutgoingMessage = {
  from: string
  to: string
  bcc?: string
  replyTo?: string
  subject: string
  text?: string
  html?: string
  attachments?: EmailAttachment[]
}

/**
 * Deliberately loose (not the real `pino.Logger` shape): keeps `Transport`
 * decoupled from Payload's logger implementation and easy to stub in tests.
 */
export interface SmtpLogger {
  info: (...args: any[]) => void
  warn: (...args: any[]) => void
  error: (...args: any[]) => void
}

export type TransportContext = {
  logger: SmtpLogger
  /** Always call through this, never the global `fetch`: it is what tests inject. */
  fetch: typeof globalThis.fetch
}

export type Transport = {
  name: string
  matches: (config: EmailConfig) => boolean
  send: (config: EmailConfig, message: OutgoingMessage, ctx: TransportContext) => Promise<{ messageId: string }>
}

export type SendEmailInput = {
  to?: string
  subject: string
  text?: string
  html?: string
  replyTo?: string
  bcc?: string
  attachments?: EmailAttachment[]
  /** Skip the panel's default bcc for this message. */
  skipDefaultBcc?: boolean
  /** Use a different global slug than the plugin default. */
  slug?: string
}

export type SendEmailResult =
  | { ok: true; messageId: string; skipped?: 'disabled' }
  | { ok: false; error: string }

export type SmtpPanelDefaults = {
  fromName?: string
  fromEmail?: string
  port?: number
  encryption?: EncryptionMode
}

export type SmtpPanelPluginOptions = {
  /** No default on purpose: whoever edits this screen controls where the site's email goes. */
  access: { read: Access; update: Access }
  slug?: string
  group?: string
  defaults?: SmtpPanelDefaults
  /** Tried in order before the built-in nodemailer transport. */
  transports?: Transport[]
  /** Defaults to the Payload config `secret`. */
  encryptionKey?: string
  /** Adds the `bcc` field to the panel. Default: false. */
  defaultBcc?: boolean
  /** Adds the test endpoint and button. Default: true. */
  testEndpoint?: boolean
  /** Wires this plugin's config as the Payload core email adapter. Default: false. */
  useAsPayloadEmailAdapter?: boolean
}
