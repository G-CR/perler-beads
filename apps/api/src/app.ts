import Fastify from 'fastify'

import { createDbClient, type DbClient } from './lib/db.ts'
import { readEnv, type AppEnv } from './lib/env.ts'
import { LocalDiskStorageAdapter, type StorageAdapter } from './lib/storage.ts'
import { registerAssetsRoutes } from './modules/assets/routes.ts'
import { registerAuthRoutes, validateAuthConfig } from './modules/auth/routes.ts'
import { registerExportRoutes } from './modules/export/routes.ts'
import { registerGenerationRoutes } from './modules/generation/routes.ts'
import { registerProjectsRoutes } from './modules/projects/routes.ts'
import { registerVersionsRoutes } from './modules/versions/routes.ts'

declare module 'fastify' {
  interface FastifyInstance {
    db: DbClient
    env: AppEnv
    storage: StorageAdapter
  }
}

export async function buildApp() {
  validateAuthConfig()
  const env = readEnv()
  const db = await createDbClient(env.databaseUrl)
  const storage = new LocalDiskStorageAdapter(env.storageRoot)

  const app = Fastify()
  app.decorate('env', env)
  app.decorate('db', db)
  app.decorate('storage', storage)

  app.addHook('onClose', async () => {
    await app.db.$disconnect()
  })

  app.get('/healthz', async () => ({ ok: true }))
  await registerAuthRoutes(app)
  await registerAssetsRoutes(app)
  await registerProjectsRoutes(app)
  await registerGenerationRoutes(app)
  await registerVersionsRoutes(app)
  await registerExportRoutes(app)

  return app
}
