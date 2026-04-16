const {
  exportVersion,
  getVersion,
  resolveApiUrl,
  saveVersionAsNew,
} = require('../../runtime/api.js')
const { createEditorStore } = require('../../runtime/editor-store.js')

let store = null
let lastSavedSignature = ''
const DRAFT_STORAGE_PREFIX = 'perler.editor.draft:'

function toPalette(input) {
  return input.map((item, index) => ({
    index,
    name: item.code || (index === 0 ? '底色' : `色号 ${index}`),
    code: item.code || '',
    hex: item.hex,
    kind: item.kind === 'background' || item.kind === 'blank' ? item.kind : 'bead',
  }))
}

function toSnapshot(version) {
  return {
    width: version.gridData.width,
    height: version.gridData.height,
    cells: version.gridData.cells,
    palette: toPalette(version.paletteData),
  }
}

function buildColorStats(snapshot) {
  const counts = new Map()
  snapshot.cells.forEach(cell => {
    counts.set(cell, (counts.get(cell) || 0) + 1)
  })

  return snapshot.palette
    .map(item => ({
      paletteIndex: item.index,
      count: counts.get(item.index) || 0,
    }))
    .filter(item => item.count > 0)
}

function buildSavePayload(snapshot) {
  return {
    gridData: {
      width: snapshot.width,
      height: snapshot.height,
      cells: snapshot.cells,
    },
    paletteData: snapshot.palette.map(item => ({
      kind: item.kind,
      hex: item.hex,
      code: item.code || undefined,
    })),
    colorStats: buildColorStats(snapshot),
  }
}

function snapshotSignature(snapshot) {
  return JSON.stringify(buildSavePayload(snapshot))
}

function draftStorageKey(versionId) {
  return `${DRAFT_STORAGE_PREFIX}${versionId}`
}

function isEditorSnapshot(input) {
  return Boolean(
    input &&
      typeof input === 'object' &&
      typeof input.width === 'number' &&
      typeof input.height === 'number' &&
      Array.isArray(input.cells) &&
      Array.isArray(input.palette),
  )
}

function loadDraft(versionId) {
  const raw = wx.getStorageSync(draftStorageKey(versionId))
  return isEditorSnapshot(raw) ? raw : null
}

function saveDraft(versionId, snapshot) {
  wx.setStorageSync(draftStorageKey(versionId), snapshot)
}

function clearDraft(versionId) {
  wx.removeStorageSync(draftStorageKey(versionId))
}

function buildCellRows(snapshot) {
  const rows = []

  for (let row = 0; row < snapshot.height; row += 1) {
    const rowItems = []
    for (let col = 0; col < snapshot.width; col += 1) {
      const index = row * snapshot.width + col
      const colorIndex = snapshot.cells[index] || 0
      const palette = snapshot.palette.find(item => item.index === colorIndex)
      rowItems.push({
        index,
        colorIndex,
        hex: palette ? palette.hex : '#ffffff',
      })
    }
    rows.push(rowItems)
  }

  return rows
}

function toErrorMessage(error) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }
  return '操作失败，请稍后重试'
}

function syncPage(page) {
  if (!store) {
    return
  }

  const snapshot = store.snapshot()
  const dirty = snapshotSignature(snapshot) !== lastSavedSignature

  if (page.data.versionId) {
    if (dirty) {
      saveDraft(page.data.versionId, snapshot)
    } else {
      clearDraft(page.data.versionId)
    }
  }

  page.setData({
    palette: snapshot.palette,
    cellRows: buildCellRows(snapshot),
    selectedColor: store.selectedColor(),
    dirty,
  })
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url,
      success(response) {
        resolve(response.tempFilePath)
      },
      fail: reject,
    })
  })
}

async function saveCurrentVersion(page) {
  if (!store) {
    throw new Error('编辑器尚未初始化')
  }

  const baseVersionId = page.data.versionId
  const snapshot = store.snapshot()
  const payload = buildSavePayload(snapshot)
  const saved = await saveVersionAsNew(page.data.versionId, payload)
  lastSavedSignature = JSON.stringify(payload)
  clearDraft(baseVersionId)
  clearDraft(saved.id)
  page.setData({
    versionId: saved.id,
  })
  syncPage(page)
  return saved
}

Page({
  data: {
    projectId: '',
    versionId: '',
    tool: 'brush',
    palette: [],
    cellRows: [],
    selectedColor: 0,
    dirty: false,
    loading: true,
    isBusy: false,
    exportImageUrl: '',
    tools: ['brush', 'erase', 'pick', 'fill', 'replace'],
  },

  onLoad(query) {
    const projectId = (query && query.projectId) || ''
    const versionId = (query && query.versionId) || ''
    this.setData({ projectId, versionId })
    return this.loadVersion(versionId)
  },

  async loadVersion(versionId) {
    this.setData({ loading: true })

    try {
      const version = await getVersion(versionId)
      const serverSnapshot = toSnapshot(version)
      const draftSnapshot = loadDraft(version.id)
      store = createEditorStore(draftSnapshot || serverSnapshot)
      lastSavedSignature = snapshotSignature(serverSnapshot)

      this.setData({
        loading: false,
        projectId: version.projectId,
        versionId: version.id,
      })
      syncPage(this)
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({
        title: toErrorMessage(error),
        icon: 'none',
      })
    }
  },

  handleSelectTool(event) {
    const tool = event.currentTarget.dataset.tool
    if (!tool) {
      return
    }
    this.setData({ tool })
  },

  handleSelectColor(event) {
    const colorIndex = Number(event.currentTarget.dataset.index)
    if (!store || !Number.isInteger(colorIndex)) {
      return
    }
    store.selectColor(colorIndex)
    syncPage(this)
  },

  handleTapCell(event) {
    const cellIndex = Number(event.currentTarget.dataset.index)
    const colorIndex = Number(event.currentTarget.dataset.colorIndex)
    if (!store || !Number.isInteger(cellIndex)) {
      return
    }

    switch (this.data.tool) {
      case 'erase':
        store.eraseCell(cellIndex)
        break
      case 'pick':
        store.pickColor(cellIndex)
        break
      case 'fill':
        store.fillArea(cellIndex)
        break
      case 'replace':
        store.replaceColor(colorIndex, store.selectedColor())
        break
      default:
        store.paintCell(cellIndex)
        break
    }

    syncPage(this)
  },

  handleUndo() {
    if (!store) {
      return
    }
    store.undo()
    syncPage(this)
  },

  handleRedo() {
    if (!store) {
      return
    }
    store.redo()
    syncPage(this)
  },

  async handleSave() {
    if (this.data.isBusy) {
      return
    }

    this.setData({ isBusy: true })
    try {
      await saveCurrentVersion(this)
      wx.showToast({
        title: '已保存为新版本',
        icon: 'success',
      })
    } catch (error) {
      wx.showToast({
        title: toErrorMessage(error),
        icon: 'none',
      })
    } finally {
      this.setData({ isBusy: false })
    }
  },

  async handleExport() {
    if (this.data.isBusy) {
      return
    }

    this.setData({ isBusy: true })
    try {
      if (this.data.dirty) {
        await saveCurrentVersion(this)
      }

      const exported = await exportVersion(this.data.versionId)
      const filePath = await downloadFile(resolveApiUrl(exported.exportImageUrl))
      await new Promise((resolve, reject) => {
        wx.saveImageToPhotosAlbum({
          filePath,
          success() {
            resolve()
          },
          fail: reject,
        })
      })

      this.setData({
        exportImageUrl: exported.exportImageUrl,
      })
      clearDraft(this.data.versionId)
      wx.showToast({
        title: '导出成功',
        icon: 'success',
      })
    } catch (error) {
      wx.showToast({
        title: toErrorMessage(error),
        icon: 'none',
      })
    } finally {
      this.setData({ isBusy: false })
    }
  },
})
