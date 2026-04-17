import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test, { after, before } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { buildApp } from '../app.ts'

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../')
const schemaPath = path.join(repoRoot, 'apps/api/prisma/schema.prisma')
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const VALID_SOURCE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAGElEQVR4nGP4jwMwEJA4KW8OR7SSIMFVABcZoWHoxxZwAAAAAElFTkSuQmCC',
  'base64',
)

const previousEnv = {
  databaseUrl: process.env.DATABASE_URL,
  storageRoot: process.env.STORAGE_ROOT,
  nodeEnv: process.env.NODE_ENV,
  authTokenSecret: process.env.AUTH_TOKEN_SECRET,
  allowDemoLogin: process.env.ALLOW_DEMO_LOGIN,
}

let testDbFilePath = ''
let testSchemaFilePath = ''
let testStorageRoot = ''

before(async () => {
  testDbFilePath = path.join(
    os.tmpdir(),
    `perler-test-db-${Date.now()}-${Math.random().toString(16).slice(2)}.db`,
  )
  testSchemaFilePath = path.join(
    os.tmpdir(),
    `perler-test-schema-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`,
  )
  testStorageRoot = await mkdtemp(path.join(os.tmpdir(), 'perler-test-storage-'))
  const databaseUrl = `file:${testDbFilePath}`

  const diff = await execFileAsync(
    'npm',
    [
      'exec',
      '-w',
      '@perler/api',
      '--',
      'prisma',
      'migrate',
      'diff',
      '--from-empty',
      '--to-schema',
      schemaPath,
      '--script',
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        HTTP_PROXY: '',
        HTTPS_PROXY: '',
      },
    },
  )
  await writeFile(testSchemaFilePath, diff.stdout, 'utf8')

  await execFileAsync('sqlite3', [testDbFilePath, `.read ${testSchemaFilePath}`])

  process.env.DATABASE_URL = databaseUrl
  process.env.STORAGE_ROOT = testStorageRoot
  process.env.NODE_ENV = 'development'
})

after(async () => {
  if (previousEnv.databaseUrl === undefined) {
    delete process.env.DATABASE_URL
  } else {
    process.env.DATABASE_URL = previousEnv.databaseUrl
  }

  if (previousEnv.storageRoot === undefined) {
    delete process.env.STORAGE_ROOT
  } else {
    process.env.STORAGE_ROOT = previousEnv.storageRoot
  }

  if (previousEnv.nodeEnv === undefined) {
    delete process.env.NODE_ENV
  } else {
    process.env.NODE_ENV = previousEnv.nodeEnv
  }

  if (previousEnv.authTokenSecret === undefined) {
    delete process.env.AUTH_TOKEN_SECRET
  } else {
    process.env.AUTH_TOKEN_SECRET = previousEnv.authTokenSecret
  }

  if (previousEnv.allowDemoLogin === undefined) {
    delete process.env.ALLOW_DEMO_LOGIN
  } else {
    process.env.ALLOW_DEMO_LOGIN = previousEnv.allowDemoLogin
  }

  if (testDbFilePath) {
    await rm(testDbFilePath, { force: true })
  }
  if (testSchemaFilePath) {
    await rm(testSchemaFilePath, { force: true })
  }
  if (testStorageRoot) {
    await rm(testStorageRoot, { recursive: true, force: true })
  }
})

function buildSingleFileMultipart(input: {
  fieldName: string
  filename: string
  contentType: string
  data: Buffer
  boundary: string
}): Buffer {
  const head = Buffer.from(
    `--${input.boundary}\r\nContent-Disposition: form-data; name="${input.fieldName}"; filename="${input.filename}"\r\nContent-Type: ${input.contentType}\r\n\r\n`,
    'utf8',
  )
  const tail = Buffer.from(`\r\n--${input.boundary}--\r\n`, 'utf8')
  return Buffer.concat([head, input.data, tail])
}

async function createGeneratedProject(app: Awaited<ReturnType<typeof buildApp>>) {
  const login = await app.inject({
    method: 'POST',
    url: '/auth/wechat-login',
    payload: { code: 'demo-code' },
  })
  assert.equal(login.statusCode, 200)
  const token = login.json().token as string

  const boundary = '----perler-upload-boundary'
  const upload = await app.inject({
    method: 'POST',
    url: '/assets/upload',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload: buildSingleFileMultipart({
      boundary,
      fieldName: 'file',
      filename: 'source.png',
      contentType: 'image/png',
      data: VALID_SOURCE_PNG,
    }),
  })
  assert.equal(upload.statusCode, 201)
  assert.equal(upload.json().url.startsWith('/assets/object/'), true)

  const project = await app.inject({
    method: 'POST',
    url: '/projects',
    headers: { authorization: `Bearer ${token}` },
    payload: { title: 'Test', sourceImageUrl: upload.json().url as string },
  })
  assert.equal(project.statusCode, 201)

  const generated = await app.inject({
    method: 'POST',
    url: `/projects/${project.json().id}/generate`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      gridWidth: 64,
      gridHeight: 64,
      colorCount: 16,
      detailLevel: 'medium',
      backgroundMode: 'keep',
    },
  })
  assert.equal(generated.statusCode, 201)
  assert.ok(generated.json().colorStats.length > 0)
  assert.equal(generated.json().previewImageUrl.startsWith('/assets/object/'), true)
  assert.equal(
    (generated.json().paletteData as Array<{ kind?: unknown; code?: unknown }>).some(
      item => item.kind === 'bead' && typeof item.code === 'string',
    ),
    true,
  )

  return {
    token,
    projectId: project.json().id as string,
    versionId: generated.json().id as string,
    palette: generated.json().paletteData as unknown[],
    previewImageUrl: generated.json().previewImageUrl as string,
    colorStats: generated.json().colorStats as unknown[],
  }
}

async function saveEditedVersionThroughApi(
  app: Awaited<ReturnType<typeof buildApp>>,
  input: {
    token: string
    versionId: string
    palette: unknown[]
  },
) {
  const saved = await app.inject({
    method: 'POST',
    url: `/versions/${input.versionId}/save-as-new`,
    headers: { authorization: `Bearer ${input.token}` },
    payload: {
      gridData: { width: 8, height: 8, cells: Array(64).fill(1) },
      paletteData: input.palette,
      colorStats: [{ paletteIndex: 1, count: 64 }],
    },
  })

  assert.equal(saved.statusCode, 201)
  return saved.json() as { id: string }
}

async function exportVersionThroughApi(
  app: Awaited<ReturnType<typeof buildApp>>,
  versionId: string,
  token: string,
) {
  const exported = await app.inject({
    method: 'POST',
    url: `/versions/${versionId}/export`,
    headers: { authorization: `Bearer ${token}` },
  })

  assert.equal(exported.statusCode, 201)
  return exported.json() as { exportImageUrl: string }
}

test('api bootstrap answers health checks', async () => {
  const app = await buildApp()
  const response = await app.inject({ method: 'GET', url: '/healthz' })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), { ok: true })
  await app.close()
})

test('api bootstrap initializes prisma client', async () => {
  const app = await buildApp()

  assert.notEqual(app.db, null)
  await app.close()
})

test('storage rejects path traversal through sibling-prefix keys', async () => {
  const storageRoot = await mkdtemp(path.join(os.tmpdir(), 'perler-storage-'))
  const siblingName = `${path.basename(storageRoot)}-sibling`
  const previousStorageRoot = process.env.STORAGE_ROOT

  process.env.STORAGE_ROOT = storageRoot

  try {
    const app = await buildApp()
    await assert.rejects(
      app.storage.putObject({
        key: `../${siblingName}/escape.txt`,
        body: Buffer.from('escape'),
        contentType: 'text/plain',
      }),
      /Invalid storage key/,
    )
    await app.close()
  } finally {
    if (previousStorageRoot === undefined) {
      delete process.env.STORAGE_ROOT
    } else {
      process.env.STORAGE_ROOT = previousStorageRoot
    }
    await rm(storageRoot, { recursive: true, force: true })
  }
})

test('api bootstrap fails fast when database url is invalid', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL
  process.env.DATABASE_URL = 'postgresql://bad'

  try {
    await assert.rejects(() => buildApp(), /URL_SCHEME_NOT_SUPPORTED/)
  } finally {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl
    }
  }
})

test('creates a generated version for a project', async () => {
  const app = await buildApp()

  try {
    const context = await createGeneratedProject(app)
    assert.ok(context.colorStats.length > 0)
    assert.equal(context.previewImageUrl.startsWith('/assets/object/'), true)

    const preview = await app.inject({
      method: 'GET',
      url: context.previewImageUrl,
    })
    assert.equal(preview.statusCode, 200)
    assert.ok(preview.body.length > 0)
  } finally {
    await app.close()
  }
})

test('saves edited grids as a new version and exports the current version', async () => {
  const app = await buildApp()

  try {
    const context = await createGeneratedProject(app)

    const saved = await app.inject({
      method: 'POST',
      url: `/versions/${context.versionId}/save-as-new`,
      headers: { authorization: `Bearer ${context.token}` },
      payload: {
        gridData: { width: 8, height: 8, cells: Array(64).fill(1) },
        paletteData: context.palette,
        colorStats: [{ paletteIndex: 1, count: 64 }],
      },
    })

    const versions = await app.inject({
      method: 'GET',
      url: `/projects/${context.projectId}/versions`,
      headers: { authorization: `Bearer ${context.token}` },
    })
    const projects = await app.inject({
      method: 'GET',
      url: '/projects',
      headers: { authorization: `Bearer ${context.token}` },
    })
    const detail = await app.inject({
      method: 'GET',
      url: `/versions/${saved.json().id}`,
      headers: { authorization: `Bearer ${context.token}` },
    })

    const exported = await app.inject({
      method: 'POST',
      url: `/versions/${saved.json().id}/export`,
      headers: { authorization: `Bearer ${context.token}` },
    })

    assert.equal(saved.statusCode, 201)
    assert.equal(versions.statusCode, 200)
    assert.equal(projects.statusCode, 200)
    assert.equal(projects.json()[0]?.currentVersionId, saved.json().id)
    assert.equal(detail.statusCode, 200)
    assert.equal(exported.statusCode, 201)
    assert.match(exported.json().exportImageUrl, /\/exports\//)
  } finally {
    await app.close()
  }
})

test('round-trips generated data into an exportable edited version', async () => {
  const app = await buildApp()

  try {
    const context = await createGeneratedProject(app)
    const saved = await saveEditedVersionThroughApi(app, context)
    const exported = await exportVersionThroughApi(app, saved.id, context.token)
    const exportedFile = await app.inject({
      method: 'GET',
      url: exported.exportImageUrl,
    })
    const exportedBody = exportedFile.rawPayload

    assert.match(exported.exportImageUrl, /\/exports\//)
    assert.equal(exportedFile.statusCode, 200)
    assert.equal(exportedFile.headers['content-type'], 'image/png')
    assert.deepEqual([...exportedBody.subarray(0, 8)], PNG_SIGNATURE)
  } finally {
    await app.close()
  }
})

test('rejects creating project with local file source url', async () => {
  const app = await buildApp()

  try {
    const login = await app.inject({
      method: 'POST',
      url: '/auth/wechat-login',
      payload: { code: 'demo-code' },
    })
    assert.equal(login.statusCode, 200)
    const token = login.json().token as string

    const project = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Unsafe', sourceImageUrl: 'file:///etc/passwd' },
    })
    assert.equal(project.statusCode, 400)
  } finally {
    await app.close()
  }
})

test('buildApp fails fast when auth secret is missing in non-development env', async () => {
  const previousNodeEnv = process.env.NODE_ENV
  const previousAuthTokenSecret = process.env.AUTH_TOKEN_SECRET
  process.env.NODE_ENV = 'production'
  delete process.env.AUTH_TOKEN_SECRET

  try {
    await assert.rejects(() => buildApp(), /AUTH_TOKEN_SECRET_REQUIRED/)
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = previousNodeEnv
    }
    if (previousAuthTokenSecret === undefined) {
      delete process.env.AUTH_TOKEN_SECRET
    } else {
      process.env.AUTH_TOKEN_SECRET = previousAuthTokenSecret
    }
  }
})

test('production app can accept demo login when ALLOW_DEMO_LOGIN is enabled', async () => {
  const previousNodeEnv = process.env.NODE_ENV
  const previousAuthTokenSecret = process.env.AUTH_TOKEN_SECRET
  const previousAllowDemoLogin = process.env.ALLOW_DEMO_LOGIN

  process.env.NODE_ENV = 'production'
  process.env.AUTH_TOKEN_SECRET = 'perler-test-secret'
  process.env.ALLOW_DEMO_LOGIN = 'true'

  const app = await buildApp()

  try {
    const login = await app.inject({
      method: 'POST',
      url: '/auth/wechat-login',
      payload: { code: 'demo-code' },
    })

    assert.equal(login.statusCode, 200)
    assert.equal(typeof login.json().token, 'string')
    assert.equal(typeof login.json().userId, 'string')
  } finally {
    await app.close()

    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = previousNodeEnv
    }

    if (previousAuthTokenSecret === undefined) {
      delete process.env.AUTH_TOKEN_SECRET
    } else {
      process.env.AUTH_TOKEN_SECRET = previousAuthTokenSecret
    }

    if (previousAllowDemoLogin === undefined) {
      delete process.env.ALLOW_DEMO_LOGIN
    } else {
      process.env.ALLOW_DEMO_LOGIN = previousAllowDemoLogin
    }
  }
})
