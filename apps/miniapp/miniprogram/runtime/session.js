const SESSION_STORAGE_KEY = 'perler.session.v1'

function isSessionRecord(input) {
  if (!input || typeof input !== 'object') {
    return false
  }

  return (
    typeof input.token === 'string' &&
    input.token.length > 0 &&
    typeof input.userId === 'string' &&
    input.userId.length > 0
  )
}

function loadSession() {
  const raw = wx.getStorageSync(SESSION_STORAGE_KEY)
  return isSessionRecord(raw) ? raw : null
}

function saveSession(session) {
  wx.setStorageSync(SESSION_STORAGE_KEY, session)
  return session
}

function clearSession() {
  wx.removeStorageSync(SESSION_STORAGE_KEY)
}

module.exports = {
  loadSession,
  saveSession,
  clearSession,
}
