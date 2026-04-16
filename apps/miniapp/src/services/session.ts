export type SessionRecord = {
  token: string
  userId: string
  nickname?: string
  avatarUrl?: string
}

const SESSION_STORAGE_KEY = 'perler.session.v1'

function isSessionRecord(input: unknown): input is SessionRecord {
  if (!input || typeof input !== 'object') {
    return false
  }

  const value = input as {
    token?: unknown
    userId?: unknown
    nickname?: unknown
    avatarUrl?: unknown
  }

  return (
    typeof value.token === 'string' &&
    value.token.length > 0 &&
    typeof value.userId === 'string' &&
    value.userId.length > 0 &&
    (value.nickname === undefined || typeof value.nickname === 'string') &&
    (value.avatarUrl === undefined || typeof value.avatarUrl === 'string')
  )
}

export function loadSession(): SessionRecord | null {
  const raw = wx.getStorageSync(SESSION_STORAGE_KEY)
  return isSessionRecord(raw) ? raw : null
}

export function saveSession(session: SessionRecord): SessionRecord {
  wx.setStorageSync(SESSION_STORAGE_KEY, session)
  return session
}

export function clearSession(): void {
  wx.removeStorageSync(SESSION_STORAGE_KEY)
}
