import type { FastifyInstance } from 'fastify'

import { requireUser } from '../auth/routes.ts'
import { ExportService } from './service.ts'

function toExportKey(pathname: string): string | null {
  if (pathname.length === 0 || pathname.includes('..')) {
    return null
  }
  return `exports/${pathname}`
}

export async function registerExportRoutes(app: FastifyInstance): Promise<void> {
  const exportService = new ExportService(app.db, app.storage)

  app.get('/exports/*', async (request, reply) => {
    const filePath = (request.params as { '*': string })['*']
    const key = toExportKey(filePath)
    if (!key) {
      reply.code(400)
      return { message: 'Invalid export url' }
    }

    try {
      const object = await app.storage.getObject({ key })
      reply.header('content-type', 'image/png')
      return object
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: unknown }).code === 'ENOENT'
      ) {
        reply.code(404)
        return { message: 'Export not found' }
      }
      throw error
    }
  })

  app.post('/versions/:id/export', { preHandler: requireUser }, async (request, reply) => {
    const versionId = (request.params as { id?: unknown }).id
    if (typeof versionId !== 'string' || versionId.length === 0) {
      reply.code(400)
      return { message: 'Invalid version id' }
    }

    try {
      const exported = await exportService.exportVersionSheet({
        versionId,
        userId: request.user!.id,
      })
      if (!exported) {
        reply.code(404)
        return { message: 'Version not found' }
      }

      reply.code(201)
      return exported
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_VERSION_DATA') {
        reply.code(400)
        return { message: 'Invalid version data' }
      }
      throw error
    }
  })
}
