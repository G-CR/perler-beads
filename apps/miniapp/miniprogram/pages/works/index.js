const {
  ensureSession,
  listProjects,
  toggleFavorite,
} = require('../../runtime/api.js')
const { splitProjectsByFilter } = require('../../runtime/works.js')

function toErrorMessage(error) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }
  return '加载作品失败'
}

Page({
  data: {
    activeFilter: 'all',
    filters: ['all', 'favorite', 'recent'],
    projects: [],
    filteredProjects: [],
    isLoading: false,
    errorMessage: '',
  },

  onShow() {
    return this.refreshProjects()
  },

  applyFilter(filter) {
    const groups = splitProjectsByFilter(this.data.projects)
    this.setData({
      activeFilter: filter,
      filteredProjects: groups[filter],
    })
  },

  async refreshProjects() {
    this.setData({
      isLoading: true,
      errorMessage: '',
    })

    try {
      await ensureSession(false)
      const projects = await listProjects()
      this.setData({ projects })
      this.applyFilter(this.data.activeFilter)
    } catch (error) {
      this.setData({
        errorMessage: toErrorMessage(error),
      })
    } finally {
      this.setData({ isLoading: false })
    }
  },

  handleFilterTap(event) {
    const filter = event.currentTarget.dataset.filter
    if (!filter) {
      return
    }
    this.applyFilter(filter)
  },

  async handleFavoriteTap(event) {
    const projectId = event.currentTarget.dataset.id
    if (!projectId) {
      return
    }

    try {
      await toggleFavorite(projectId)
      await this.refreshProjects()
    } catch (error) {
      wx.showToast({
        title: toErrorMessage(error),
        icon: 'none',
      })
    }
  },

  handleOpenProject(event) {
    const projectId = event.currentTarget.dataset.id
    const versionId = event.currentTarget.dataset.versionId

    if (!projectId || !versionId) {
      wx.showToast({
        title: '当前作品还没有可编辑版本',
        icon: 'none',
      })
      return
    }

    wx.navigateTo({
      url: `/pages/editor/index?projectId=${projectId}&versionId=${versionId}`,
    })
  },

  handleCreateTap() {
    wx.switchTab({
      url: '/pages/create/index',
    })
  },
})
