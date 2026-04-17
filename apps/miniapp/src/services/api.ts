import type { GenerateParams } from '@perler/shared'

import { clearSession, loadSession, saveSession, type SessionRecord } from './session.ts'

type RequestMethod = 'GET' | 'POST' | 'PATCH'

type RequestOptions = {
  path: string
  method?: RequestMethod
  data?: unknown
  header?: Record<string, string>
  skipAuth?: boolean
  retryOnUnauthorized?: boolean
}

export type ProjectRecord = {
  id: string
  title: string
  sourceImageUrl: string
  isFavorite: boolean
  currentVersionId?: string | null
  updatedAt: string
}

export type PaletteRecord = {
  kind: string
  hex: string
  code?: string
}

export type VersionRecord = {
  id: string
  projectId: string
  versionNo: number
  sourceType: string
  paramsSnapshot: GenerateParams
  gridData: {
    width: number
    height: number
    cells: number[]
  }
  paletteData: PaletteRecord[]
  colorStats: Array<{
    paletteIndex: number
    count: number
  }>
  previewImageUrl: string
  updatedAt: string
}

export type ExportRecord = {
  id: string
  projectId: string
  versionId: string
  exportImageUrl: string
  updatedAt: string
}

const DEFAULT_API_BASE_URL = 'http://183.66.27.19:27099'

function getApiBaseUrl(): string {
  try {
    const app = getApp<{ globalData?: { apiBaseUrl?: string } }>()
    return app?.globalData?.apiBaseUrl ?? DEFAULT_API_BASE_URL
  } catch {
    return DEFAULT_API_BASE_URL
  }
}

export function resolveApiUrl(pathname: string): string {
  if (/^https?:\/\//.test(pathname)) {
    return pathname
  }
  return `${getApiBaseUrl()}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
}

function requestRaw<T>(options: {
  url: string
  method?: RequestMethod
  data?: unknown
  header?: Record<string, string>
}): Promise<{ statusCode: number; data: T }> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: options.url,
      method: options.method ?? 'GET',
      data: options.data,
      header: options.header,
      success: response => {
        resolve({
          statusCode: response.statusCode,
          data: response.data as T,
        })
      },
      fail: reject,
    })
  })
}

function normalizeRequestData(method: RequestMethod | undefined, data: unknown): unknown {
  if (data !== undefined) {
    return data
  }

  if (method && method !== 'GET') {
    return {}
  }

  return undefined
}

function toErrorMessage(input: unknown, fallback: string): string {
  if (
    input &&
    typeof input === 'object' &&
    'message' in input &&
    typeof (input as { message?: unknown }).message === 'string'
  ) {
    return (input as { message: string }).message
  }

  return fallback
}

async function loginWithDemoCode(): Promise<SessionRecord> {
  const response = await requestRaw<{ token: string; userId: string; nickname?: string; avatarUrl?: string }>({
    url: resolveApiUrl('/auth/wechat-login'),
    method: 'POST',
    data: { code: 'demo-code' },
  })

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(toErrorMessage(response.data, 'Login failed'))
  }

  return saveSession({
    token: response.data.token,
    userId: response.data.userId,
    nickname: response.data.nickname ?? '拼豆玩家',
    avatarUrl: response.data.avatarUrl ?? '',
  })
}

export async function ensureSession(force = false): Promise<SessionRecord> {
  const cached = force ? null : loadSession()
  if (cached) {
    return cached
  }
  return loginWithDemoCode()
}

export async function apiRequest<T>(options: RequestOptions): Promise<T> {
  const session = options.skipAuth ? null : await ensureSession()
  const header = {
    ...(options.header ?? {}),
    ...(session ? { authorization: `Bearer ${session.token}` } : {}),
  }

  const response = await requestRaw<T>({
    url: resolveApiUrl(options.path),
    method: options.method,
    data: normalizeRequestData(options.method, options.data),
    header,
  })

  if (
    response.statusCode === 401 &&
    !options.skipAuth &&
    options.retryOnUnauthorized !== false
  ) {
    clearSession()
    await ensureSession(true)
    return apiRequest({
      ...options,
      retryOnUnauthorized: false,
    })
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(toErrorMessage(response.data, `Request failed: ${response.statusCode}`))
  }

  return response.data
}

export async function uploadAsset(filePath: string): Promise<{ url: string }> {
  const session = await ensureSession()

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: resolveApiUrl('/assets/upload'),
      filePath,
      name: 'file',
      header: {
        authorization: `Bearer ${session.token}`,
      },
      success: response => {
        if (response.statusCode === 401) {
          clearSession()
          reject(new Error('UNAUTHORIZED'))
          return
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Upload failed: ${response.statusCode}`))
          return
        }
        try {
          resolve(JSON.parse(response.data) as { url: string })
        } catch (error) {
          reject(error)
        }
      },
      fail: reject,
    })
  }).catch(async error => {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      await ensureSession(true)
      return uploadAsset(filePath)
    }
    throw error
  })
}

export function listProjects(): Promise<ProjectRecord[]> {
  return apiRequest<ProjectRecord[]>({
    path: '/projects',
  })
}

export function toggleFavorite(projectId: string): Promise<ProjectRecord> {
  return apiRequest<ProjectRecord>({
    path: `/projects/${projectId}/favorite`,
    method: 'PATCH',
  })
}

export function createProject(input: {
  title: string
  sourceImageUrl: string
}): Promise<ProjectRecord> {
  return apiRequest<ProjectRecord>({
    path: '/projects',
    method: 'POST',
    data: input,
  })
}

export function generateProject(
  projectId: string,
  params: GenerateParams,
): Promise<VersionRecord> {
  return apiRequest<VersionRecord>({
    path: `/projects/${projectId}/generate`,
    method: 'POST',
    data: params,
  })
}

export function getVersion(versionId: string): Promise<VersionRecord> {
  return apiRequest<VersionRecord>({
    path: `/versions/${versionId}`,
  })
}

export function saveVersionAsNew(
  versionId: string,
  input: {
    gridData: {
      width: number
      height: number
      cells: number[]
    }
    paletteData: PaletteRecord[]
    colorStats: Array<{ paletteIndex: number; count: number }>
  },
): Promise<VersionRecord> {
  return apiRequest<VersionRecord>({
    path: `/versions/${versionId}/save-as-new`,
    method: 'POST',
    data: input,
  })
}

export function exportVersion(versionId: string): Promise<ExportRecord> {
  return apiRequest<ExportRecord>({
    path: `/versions/${versionId}/export`,
    method: 'POST',
  })
}
