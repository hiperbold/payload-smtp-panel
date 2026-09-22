import type { Transport } from './types.js'

/**
 * Runtime config registered by `smtpPanelPlugin` at build time, keyed by
 * global slug, so that `sendEmail(payload, input)` can pick up the
 * configured transports without the caller having to pass them again on
 * every call. Explicit `runtime.transports` passed to `sendEmail` (used by
 * tests) always takes priority over this registry.
 */
export type PluginRuntimeConfig = {
  transports: Transport[]
}

const runtimeConfigs = new Map<string, PluginRuntimeConfig>()

export function registerRuntimeConfig(slug: string, config: PluginRuntimeConfig): void {
  runtimeConfigs.set(slug, config)
}

export function getRuntimeConfig(slug: string): PluginRuntimeConfig | undefined {
  return runtimeConfigs.get(slug)
}
