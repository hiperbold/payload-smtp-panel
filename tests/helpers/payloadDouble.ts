import type { Payload } from 'payload'

export type LogEntry = { level: 'error' | 'info' | 'warn'; message: string }

export type PayloadDouble = {
  payload: Payload
  logs: LogEntry[]
  getStore: () => Record<string, unknown>
  setStore: (next: Record<string, unknown>) => void
}

/**
 * Minimal payload double: an object with `logger`, `findGlobal`,
 * `db.findGlobal` and `updateGlobal`: no database, no network. Cast to
 * `Payload` at the boundary since it only implements what the plugin
 * actually calls.
 */
export function createPayloadDouble(initialGlobal: Record<string, unknown> = {}): PayloadDouble {
  let store: Record<string, unknown> = { ...initialGlobal }
  const logs: LogEntry[] = []

  const double = {
    logger: {
      info: (message: string) => logs.push({ level: 'info', message }),
      warn: (message: string) => logs.push({ level: 'warn', message }),
      error: (message: string) => logs.push({ level: 'error', message }),
    },
    db: {
      findGlobal: async () => ({ ...store }),
    },
    findGlobal: async () => ({ ...store }),
    updateGlobal: async ({ data }: { data: Record<string, unknown> }) => {
      store = { ...store, ...data }
      return { ...store }
    },
  }

  return {
    payload: double as unknown as Payload,
    logs,
    getStore: () => store,
    setStore: (next: Record<string, unknown>) => {
      store = next
    },
  }
}
