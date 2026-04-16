const { ensureSession } = require('../../runtime/api.js')
const { loadSession } = require('../../runtime/session.js')

function permissionLabel(input) {
  if (input === true) {
    return '已授权保存到相册'
  }
  if (input === false) {
    return '未授权保存到相册'
  }
  return '尚未查询导出权限'
}

function loadExportPermission() {
  return new Promise((resolve, reject) => {
    wx.getSetting({
      success(result) {
        resolve(result.authSetting['scope.writePhotosAlbum'])
      },
      fail: reject,
    })
  })
}

Page({
  data: {
    userId: '',
    nickname: '拼豆玩家',
    avatarUrl: '',
    exportPermissionText: permissionLabel(undefined),
  },

  async onShow() {
    try {
      const session = (await ensureSession(false)) || loadSession()
      if (session) {
        this.setData({
          userId: session.userId,
          nickname: session.nickname || '拼豆玩家',
          avatarUrl: session.avatarUrl || '',
        })
      }
    } catch {
      const session = loadSession()
      if (session) {
        this.setData({
          userId: session.userId,
          nickname: session.nickname || '拼豆玩家',
          avatarUrl: session.avatarUrl || '',
        })
      }
    }

    await this.refreshPermission()
  },

  async refreshPermission() {
    try {
      const granted = await loadExportPermission()
      this.setData({
        exportPermissionText: permissionLabel(granted),
      })
    } catch {
      this.setData({
        exportPermissionText: '权限查询失败，请稍后重试',
      })
    }
  },
})
