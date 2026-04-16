import type { FastifyInstance } from 'fastify'

import { requireUser } from '../auth/routes.ts'
import { ProjectsService } from '../projects/service.ts'

type GridDataPayload = {
  width: number
  height: number
  cells: number[]
}

function isGridDataPayload(input: unknown): input is GridDataPayload {
  if (!input || typeof input !== 'object') {
    return false
  }
  const value = input as {
    width?: unknown
    height?: unknown
    cells?: unknown
  }
  if (
    typeof value.width !== 'number' ||
    !Number.isInteger(value.width) ||
    typeof value.height !== 'number' ||
    !Number.isInteger(value.height) ||
    !Array.isArray(value.cells)
  ) {
    return false
  }
  if (value.width <= 0 || value.height <= 0) {
    return false
  }
  if (value.cells.length !== value.width * value.height) {
    return false
  }
  return value.cells.every(cell => typeof cell === 'number' && Number.isInteger(cell))
}

function isColorStatsPayload(input: unknown): boolean {
  if (!Array.isArray(input)) {
    return false
  }
  return input.every(item => {
    if (!item || typeof item !== 'object') {
      return false
    }
    const value = item as { paletteIndex?: unknown; count?: unknown }
    return (
      typeof value.paletteIndex === 'number' &&
      Number.isInteger(value.paletteIndex) &&
      value.paletteIndex >= 0 &&
      typeof value.count === 'number' &&
      Number.isInteger(value.count) &&
      value.count >= 0
    )
  })
}

export async function registerVersionsRoutes(app: FastifyInstance): Promise<void> {
  const projectsService = new ProjectsService(app.db)

  app.get(
    '/projects/:id/versions',
    { preHandler: requireUser },
    async (request, reply) => {
      const projectId = (request.params as { id?: unknown }).id
      if (typeof projectId !== 'string' || projectId.length === 0) {
        reply.code(400)
        return { message: 'Invalid project id' }
      }

      const versions = await projectsService.listProjectVersions({
        userId: request.user!.id,
        projectId,
      })
      if (!versions) {
        reply.code(404)
        return { message: 'Project not found' }
      }

      return versions
    },
  )

  app.get('/versions/:id', { preHandler: requireUser }, async (request, reply) => {
    const versionId = (request.params as { id?: unknown }).id
    if (typeof versionId !== 'string' || versionId.length === 0) {
      reply.code(400)
      return { message: 'Invalid version id' }
    }

    const version = await projectsService.getVersion({
      userId: request.user!.id,
      versionId,
    })
    if (!version) {
      reply.code(404)
      return { message: 'Version not found' }
    }

    return version
  })

  app.post(
    '/versions/:id/save-as-new',
    { preHandler: requireUser },
    async (request, reply) => {
      const versionId = (request.params as { id?: unknown }).id
      const payload = request.body as
        | {
            gridData?: unknown
            paletteData?: unknown
            colorStats?: unknown
          }
        | undefined
      if (typeof versionId !== 'string' || versionId.length === 0) {
        reply.code(400)
        return { message: 'Invalid version id' }
      }
      if (
        !isGridDataPayload(payload?.gridData) ||
        !Array.isArray(payload.paletteData) ||
        !isColorStatsPayload(payload.colorStats)
      ) {
        reply.code(400)
        return { message: 'Invalid payload' }
      }

      const version = await projectsService.saveEditedVersion({
        userId: request.user!.id,
        baseVersionId: versionId,
        gridData: payload.gridData,
        paletteData: payload.paletteData,
        colorStats: payload.colorStats,
      })
      if (!version) {
        reply.code(404)
        return { message: 'Version not found' }
      }

      reply.code(201)
      return version
    },
  )
}
