export { smtpPanelPlugin } from './plugin.js'
export { sendEmail } from './utilities/sendEmail.js'
export type { SendEmailRuntimeOptions } from './utilities/sendEmail.js'
export { postJsonWithRetry } from './utilities/retry.js'
export { decryptSecret, encryptSecret, isEncrypted } from './utilities/crypto.js'
export { nodemailerTransport } from './transports/nodemailer.js'
export { sendkitTransport } from './transports/sendkit.js'
export { resendTransport } from './transports/resend.js'

export type {
  EmailAttachment,
  EmailConfig,
  EncryptionMode,
  OutgoingMessage,
  SendEmailInput,
  SendEmailResult,
  SmtpLogger,
  SmtpPanelDefaults,
  SmtpPanelPluginOptions,
  Transport,
  TransportContext,
} from './types.js'
