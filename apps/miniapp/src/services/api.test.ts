import assert from 'node:assert/strict'
import test from 'node:test'

import { exportVersion } from './api.ts'

type MiniProgramRequestOptions = {
  url: string
  method?: string
  data?: unknown
  header?: Record<string, string>
  success?: (response: { statusCode: number; data: unknown }) => void
  fail?: (error: { errMsg?: string }) => void
}

function installMiniProgramApiStub() {
  const storage = new Map<string, unknown>()
  const requests: MiniProgramRequestOptions[] = []
  const globalScope = globalThis as typeof globalThis & {
    getApp: () => { globalData?: { apiBaseUrl?: string } }
    wx: {
      getStorageSync: (key: string) => unknown
      setStorageSync: (key: string, value: unknown) => void
      removeStorageSync: (key: string) => void
      request: (options: MiniProgramRequestOptions) => void
    }
  }

  storage.set('perler.session.v1', {
    token: 'test-token',
    userId: 'user_123',
  })

  globalScope.getApp = () => ({
    globalData: {
      apiBaseUrl: 'http://127.0.0.1:3000',
    },
  })
  globalScope.wx = {
    getStorageSync(key) {
      return storage.get(key)
    },
    setStorageSync(key, value) {
      storage.set(key, value)
    },
    removeStorageSync(key) {
      storage.delete(key)
    },
    request(options) {
      requests.push(options)
      options.success?.({
        statusCode: 200,
        data: {
          id: 'exp_123',
          projectId: 'proj_123',
          versionId: 'ver_123',
          exportImageUrl: '/exports/ver_123.png',
          updatedAt: '2026-04-15T12:00:00.000Z',
        },
      })
    },
  }

  return { requests }
}

test('exportVersion sends an explicit empty payload for mini program POST requests', async () => {
  const { requests } = installMiniProgramApiStub()

  const result = await exportVersion('ver_123')

  assert.equal(result.exportImageUrl, '/exports/ver_123.png')
  assert.equal(requests.length, 1)
  assert.equal(requests[0]?.url, 'http://127.0.0.1:3000/versions/ver_123/export')
  assert.equal(requests[0]?.method, 'POST')
  assert.equal(requests[0]?.header?.authorization, 'Bearer test-token')
  assert.deepEqual(requests[0]?.data, {})
})
