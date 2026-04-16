import path from 'node:path'

export interface AppEnv {
  host: string
  port: number
  databaseUrl: string
  storageRoot: string
}

function parsePort(raw: string | undefined): number {
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 3000
  }
  return parsed
}

export function readEnv(input: NodeJS.ProcessEnv = process.env): AppEnv {
  const databaseUrl = input.DATABASE_URL ?? 'file:./dev.db'
  const storageRoot = input.STORAGE_ROOT ?? path.resolve(process.cwd(), '.data')

  return {
    host: input.HOST ?? '0.0.0.0',
    port: parsePort(input.PORT),
    databaseUrl,
    storageRoot,
  }
}
