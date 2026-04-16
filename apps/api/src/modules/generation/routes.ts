import { generateParamsSchema } from '@perler/shared'
import type { FastifyInstance } from 'fastify'

import { requireUser } from '../auth/routes.ts'
import { GenerationService } from './service.ts'

export async function registerGenerationRoutes(app: FastifyInstance): Promise<void> {
  const generationService = new GenerationService(app.db, app.storage)

  app.post(
    '/projects/:id/generate',
    { preHandler: requireUser },
    async (request, reply) => {
      const projectId = (request.params as { id?: unknown }).id
      if (typeof projectId !== 'string' || projectId.length === 0) {
        reply.code(400)
        return { message: 'Invalid project id' }
      }

      const parsedParams = generateParamsSchema.safeParse(request.body)
      if (!parsedParams.success) {
        reply.code(400)
        return { message: 'Invalid generation params' }
      }

      try {
        const version = await generationService.generateVersion({
          projectId,
          params: parsedParams.data,
          userId: request.user!.id,
        })
        reply.code(201)
        return version
      } catch (error) {
        if (error instanceof Error && error.message === 'PROJECT_NOT_FOUND') {
          reply.code(404)
          return { message: 'Project not found' }
        }
        if (
          error instanceof Error &&
          (error.message === 'INVALID_PROJECT_SOURCE_URL' ||
            error.message === 'SOURCE_IMAGE_NOT_FOUND')
        ) {
          reply.code(400)
          return { message: 'Invalid project source image' }
        }
        throw error
      }
    },
  )
}
