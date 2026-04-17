import path from 'node:path'

export interface AppEnv {
  host: string
  port: number
  databaseUrl: string
  storageRoot: string
  allowDemoLogin: boolean
}

function parsePort(raw: string | undefined): number {
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 3000
  }
  return parsed
}

function parseBoolean(raw: string | undefined): boolean {
  if (!raw) {
    return false
  }

  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

export function readEnv(input: NodeJS.ProcessEnv = process.env): AppEnv {
  const databaseUrl = input.DATABASE_URL ?? 'file:./dev.db'
  const storageRoot = input.STORAGE_ROOT ?? path.resolve(process.cwd(), '.data')

  return {
    host: input.HOST ?? '0.0.0.0',
    port: parsePort(input.PORT),
    databaseUrl,
    storageRoot,
    allowDemoLogin: parseBoolean(input.ALLOW_DEMO_LOGIN),
  }
}
