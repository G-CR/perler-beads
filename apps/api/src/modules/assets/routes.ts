import path from 'node:path'

import multipart from '@fastify/multipart'
import type { FastifyInstance } from 'fastify'

import { requireUser } from '../auth/routes.ts'

const ASSET_OBJECT_PREFIX = '/assets/object/'

function sanitizeFilename(filename: string): string {
  const basename = path.basename(filename)
  return basename.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function guessContentTypeFromKey(key: string): string {
  const ext = path.extname(key).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  return 'application/octet-stream'
}

export function buildAssetObjectUrl(key: string): string {
  const encoded = Buffer.from(key, 'utf8')
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/g, '')
  return `${ASSET_OBJECT_PREFIX}${encoded}`
}

export function parseAssetObjectUrl(url: string): string | null {
  if (!url.startsWith(ASSET_OBJECT_PREFIX)) {
    return null
  }

  const encoded = url.slice(ASSET_OBJECT_PREFIX.length)
  if (encoded.length === 0) {
    return null
  }

  try {
    const normalized = encoded.replaceAll('-', '+').replaceAll('_', '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const key = Buffer.from(padded, 'base64').toString('utf8')
    if (key.length === 0 || buildAssetObjectUrl(key) !== url) {
      return null
    }
    return key
  } catch {
    return null
  }
}

export async function registerAssetsRoutes(app: FastifyInstance): Promise<void> {
  await app.register(multipart)

  app.get('/assets/object/*', async (request, reply) => {
    const encodedKey = (request.params as { '*': string })['*']
    const key = parseAssetObjectUrl(`${ASSET_OBJECT_PREFIX}${encodedKey}`)
    if (!key) {
      reply.code(400)
      return { message: 'Invalid asset url' }
    }

    try {
      const object = await app.storage.getObject({ key })
      reply.header('content-type', guessContentTypeFromKey(key))
      return object
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: unknown }).code === 'ENOENT'
      ) {
        reply.code(404)
        return { message: 'Asset not found' }
      }
      throw error
    }
  })

  app.post(
    '/assets/upload',
    { preHandler: requireUser },
    async (request, reply) => {
      const file = await request.file()
      if (!file) {
        reply.code(400)
        return { message: 'File is required' }
      }

      const body = await file.toBuffer()
      const key = `uploads/${request.user!.id}/${Date.now()}-${sanitizeFilename(
        file.filename,
      )}`
      await app.storage.putObject({
        key,
        body,
        contentType: file.mimetype || 'application/octet-stream',
      })

      reply.code(201)
      return { url: buildAssetObjectUrl(key) }
    },
  )
}
