import { createHmac, timingSafeEqual } from 'node:crypto'

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

type TokenPayload = {
  sub: string
  iat: number
}

export type AuthenticatedUser = {
  id: string
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser
  }
}

const TOKEN_ALGORITHM = 'sha256'
const DEV_DEMO_CODE = 'demo-code'

function tokenSecret(): string {
  const configured = process.env.AUTH_TOKEN_SECRET
  if (configured && configured.length > 0) {
    return configured
  }
  if (process.env.NODE_ENV === 'development') {
    return 'perler-dev-secret'
  }
  throw new Error('AUTH_TOKEN_SECRET_REQUIRED')
}

export function validateAuthConfig(): void {
  void tokenSecret()
}

function encodeBase64Url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url')
}

function decodeBase64Url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function signTokenPayload(encodedPayload: string): string {
  return createHmac(TOKEN_ALGORITHM, tokenSecret()).update(encodedPayload).digest('base64url')
}

export function issueAccessToken(userId: string): string {
  const encodedPayload = encodeBase64Url(
    JSON.stringify({
      sub: userId,
      iat: Date.now(),
    } satisfies TokenPayload),
  )
  const signature = signTokenPayload(encodedPayload)
  return `${encodedPayload}.${signature}`
}

function verifyAccessToken(token: string): TokenPayload | null {
  const parts = token.split('.')
  if (parts.length !== 2) {
    return null
  }
  const [encodedPayload, signature] = parts
  if (!encodedPayload || !signature) {
    return null
  }

  const expectedSignature = signTokenPayload(encodedPayload)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)
  if (signatureBuffer.length !== expectedBuffer.length) {
    return null
  }
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as Partial<TokenPayload>
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      return null
    }
    return {
      sub: payload.sub,
      iat: typeof payload.iat === 'number' ? payload.iat : 0,
    }
  } catch {
    return null
  }
}

function readBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return null
  }
  return header.slice('Bearer '.length).trim()
}

export async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = readBearerToken(request)
  if (!token) {
    reply.code(401)
    throw new Error('UNAUTHORIZED')
  }

  const payload = verifyAccessToken(token)
  if (!payload) {
    reply.code(401)
    throw new Error('UNAUTHORIZED')
  }

  const user = await request.server.db.user.findUnique({
    where: { id: payload.sub },
    select: { id: true },
  })
  if (!user) {
    reply.code(401)
    throw new Error('UNAUTHORIZED')
  }

  request.user = { id: user.id }
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/wechat-login', async (request, reply) => {
    const code = (request.body as { code?: unknown } | null)?.code
    if (typeof code !== 'string' || code.length === 0) {
      reply.code(400)
      return { message: 'Invalid code' }
    }

    const demoLoginEnabled =
      process.env.NODE_ENV === 'development' || app.env.allowDemoLogin

    if (code !== DEV_DEMO_CODE) {
      reply.code(401)
      return { message: 'Invalid code' }
    }

    if (!demoLoginEnabled) {
      reply.code(401)
      return { message: 'Demo login disabled' }
    }

    const user = await app.db.user.create({ data: {} })
    return {
      token: issueAccessToken(user.id),
      userId: user.id,
    }
  })
}
