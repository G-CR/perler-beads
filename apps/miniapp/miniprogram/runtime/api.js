const { clearSession, loadSession, saveSession } = require('./session.js')

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3000'

function getApiBaseUrl() {
  try {
    const app = getApp()
    return (app && app.globalData && app.globalData.apiBaseUrl) || DEFAULT_API_BASE_URL
  } catch {
    return DEFAULT_API_BASE_URL
  }
}

function resolveApiUrl(pathname) {
  if (/^https?:\/\//.test(pathname)) {
    return pathname
  }

  return `${getApiBaseUrl()}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
}

function requestRaw(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: options.url,
      method: options.method || 'GET',
      data: options.data,
      header: options.header,
      success(response) {
        resolve({
          statusCode: response.statusCode,
          data: response.data,
        })
      },
      fail(error) {
        reject(new Error((error && error.errMsg) || 'Network request failed'))
      },
    })
  })
}

function normalizeRequestData(method, data) {
  if (data !== undefined) {
    return data
  }

  if (method && method !== 'GET') {
    return {}
  }

  return undefined
}

function toErrorMessage(input, fallback) {
  if (input && typeof input === 'object' && typeof input.message === 'string') {
    return input.message
  }

  return fallback
}

async function loginWithDemoCode() {
  const response = await requestRaw({
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
    nickname: response.data.nickname || '拼豆玩家',
    avatarUrl: response.data.avatarUrl || '',
  })
}

async function ensureSession(force) {
  const cached = force ? null : loadSession()
  if (cached) {
    return cached
  }
  return loginWithDemoCode()
}

async function apiRequest(options) {
  const session = options.skipAuth ? null : await ensureSession(false)
  const header = Object.assign({}, options.header || {}, session ? {
    authorization: `Bearer ${session.token}`,
  } : {})

  const response = await requestRaw({
    url: resolveApiUrl(options.path),
    method: options.method,
    data: normalizeRequestData(options.method, options.data),
    header,
  })

  if (response.statusCode === 401 && !options.skipAuth && options.retryOnUnauthorized !== false) {
    clearSession()
    await ensureSession(true)
    return apiRequest(Object.assign({}, options, {
      retryOnUnauthorized: false,
    }))
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(toErrorMessage(response.data, `Request failed: ${response.statusCode}`))
  }

  return response.data
}

function uploadAsset(filePath) {
  return ensureSession(false)
    .then(session => new Promise((resolve, reject) => {
      wx.uploadFile({
        url: resolveApiUrl('/assets/upload'),
        filePath,
        name: 'file',
        header: {
          authorization: `Bearer ${session.token}`,
        },
        success(response) {
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
            resolve(JSON.parse(response.data))
          } catch (error) {
            reject(error)
          }
        },
        fail(error) {
          reject(new Error((error && error.errMsg) || 'Upload request failed'))
        },
      })
    }))
    .catch(async error => {
      if (error instanceof Error && error.message === 'UNAUTHORIZED') {
        await ensureSession(true)
        return uploadAsset(filePath)
      }
      throw error
    })
}

function listProjects() {
  return apiRequest({
    path: '/projects',
  })
}

function toggleFavorite(projectId) {
  return apiRequest({
    path: `/projects/${projectId}/favorite`,
    method: 'PATCH',
  })
}

function createProject(input) {
  return apiRequest({
    path: '/projects',
    method: 'POST',
    data: input,
  })
}

function generateProject(projectId, params) {
  return apiRequest({
    path: `/projects/${projectId}/generate`,
    method: 'POST',
    data: params,
  })
}

function getVersion(versionId) {
  return apiRequest({
    path: `/versions/${versionId}`,
  })
}

function saveVersionAsNew(versionId, input) {
  return apiRequest({
    path: `/versions/${versionId}/save-as-new`,
    method: 'POST',
    data: input,
  })
}

function exportVersion(versionId) {
  return apiRequest({
    path: `/versions/${versionId}/export`,
    method: 'POST',
  })
}

module.exports = {
  ensureSession,
  resolveApiUrl,
  uploadAsset,
  listProjects,
  toggleFavorite,
  createProject,
  generateProject,
  getVersion,
  saveVersionAsNew,
  exportVersion,
}
