import type { FastifyInstance } from 'fastify'

import { requireUser } from '../auth/routes.ts'
import { parseAssetObjectUrl } from '../assets/routes.ts'
import { ProjectsService } from './service.ts'

export async function registerProjectsRoutes(app: FastifyInstance): Promise<void> {
  const projectsService = new ProjectsService(app.db)

  app.post('/projects', { preHandler: requireUser }, async (request, reply) => {
    const payload = request.body as
      | {
          title?: unknown
          sourceImageUrl?: unknown
        }
      | undefined

    if (
      typeof payload?.title !== 'string' ||
      payload.title.length === 0 ||
      typeof payload.sourceImageUrl !== 'string' ||
      payload.sourceImageUrl.length === 0
    ) {
      reply.code(400)
      return { message: 'Invalid payload' }
    }
    if (!parseAssetObjectUrl(payload.sourceImageUrl)) {
      reply.code(400)
      return { message: 'Invalid sourceImageUrl' }
    }

    const project = await projectsService.createProject({
      userId: request.user!.id,
      title: payload.title,
      sourceImageUrl: payload.sourceImageUrl,
    })

    reply.code(201)
    return project
  })

  app.get('/projects', { preHandler: requireUser }, async request => {
    return projectsService.listProjects(request.user!.id)
  })

  app.patch(
    '/projects/:id/favorite',
    { preHandler: requireUser },
    async (request, reply) => {
      const projectId = (request.params as { id?: unknown }).id
      if (typeof projectId !== 'string' || projectId.length === 0) {
        reply.code(400)
        return { message: 'Invalid project id' }
      }

      const project = await projectsService.toggleFavorite({
        userId: request.user!.id,
        projectId,
      })
      if (!project) {
        reply.code(404)
        return { message: 'Project not found' }
      }

      return project
    },
  )
}
