import type { Config } from 'payload'
import { buildEmailAdapter } from './adapter.js'
import { buildTestEndpoint } from './endpoints/testEndpoint.js'
import { buildEmailSettingsGlobal } from './global.js'
import { registerRuntimeConfig } from './registry.js'
import { nodemailerTransport } from './transports/nodemailer.js'
import type { SmtpPanelPluginOptions } from './types.js'

/**
 * Adds an SMTP/email settings global to the admin panel (host, port,
 * encryption, credentials, sender), with the secret encrypted at rest, a
 * test endpoint/button, and pluggable HTTPS transports tried before plain
 * SMTP. `access` has no default on purpose: whoever can edit this screen
 * controls where the site's email goes.
 */
export function smtpPanelPlugin(options: SmtpPanelPluginOptions) {
  return (config: Config): Config => {
    const slug = options.slug ?? 'email-settings'
    const encryptionKey = options.encryptionKey ?? config.secret

    if (!encryptionKey) {
      throw new Error(
        '[smtp-panel] Missing encryption key: pass `encryptionKey` in the plugin options or set `secret` in the Payload config.',
      )
    }

    registerRuntimeConfig(slug, {
      transports: [...(options.transports ?? []), nodemailerTransport()],
    })

    const nextConfig: Config = {
      ...config,
      globals: [...(config.globals ?? []), buildEmailSettingsGlobal({ ...options, encryptionKey })],
    }

    if (options.testEndpoint !== false) {
      nextConfig.endpoints = [...(config.endpoints ?? []), buildTestEndpoint(options)]
    }

    if (options.useAsPayloadEmailAdapter) {
      nextConfig.email = buildEmailAdapter({ slug })
    }

    return nextConfig
  }
}
