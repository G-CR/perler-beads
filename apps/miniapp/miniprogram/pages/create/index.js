const {
  createProject,
  ensureSession,
  generateProject,
  uploadAsset,
} = require('../../runtime/api.js')
const {
  buildGeneratePayload,
  defaultCreateForm,
  mergeCreateForm,
  defaultCropState,
  patchCropState,
} = require('../../runtime/create.js')

const DETAIL_LEVEL_OPTIONS = ['low', 'medium', 'high']
const BACKGROUND_OPTIONS = ['keep', 'remove']

function chooseMedia() {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: resolve,
      fail: reject,
    })
  })
}

function parseIntegerInput(input, fallback) {
  const parsed = Number(input)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function toErrorMessage(error) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }
  return '生成失败，请稍后重试'
}

Page({
  data: {
    form: defaultCreateForm(),
    crop: defaultCropState(),
    selectedImagePath: '',
    isSubmitting: false,
    detailLevelOptions: DETAIL_LEVEL_OPTIONS,
    backgroundOptions: BACKGROUND_OPTIONS,
    detailLevelIndex: DETAIL_LEVEL_OPTIONS.indexOf(defaultCreateForm().detailLevel),
    backgroundIndex: BACKGROUND_OPTIONS.indexOf(defaultCreateForm().backgroundMode),
    statusText: '先选图，再设置生成参数。',
  },

  async handleChooseImage() {
    try {
      const result = await chooseMedia()
      const firstFile = result.tempFiles[0]
      if (!firstFile || !firstFile.tempFilePath) {
        return
      }

      this.setData({
        selectedImagePath: firstFile.tempFilePath,
        crop: defaultCropState(),
        statusText: '已载入图片，当前按全图生成。',
      })
    } catch (error) {
      wx.showToast({
        title: toErrorMessage(error),
        icon: 'none',
      })
    }
  },

  handleNumberFieldInput(event) {
    const field = event.currentTarget.dataset.field
    if (!field) {
      return
    }

    const nextValue = parseIntegerInput(event.detail.value, this.data.form[field])
    const patch = {}
    patch[field] = nextValue
    this.setData({
      form: mergeCreateForm(this.data.form, patch),
    })
  },

  handleDetailLevelChange(event) {
    const index = Number(event.detail.value)
    const detailLevel = DETAIL_LEVEL_OPTIONS[index] || 'medium'
    this.setData({
      detailLevelIndex: index,
      form: mergeCreateForm(this.data.form, { detailLevel }),
    })
  },

  handleBackgroundModeChange(event) {
    const index = Number(event.detail.value)
    const backgroundMode = BACKGROUND_OPTIONS[index] || 'keep'
    this.setData({
      backgroundIndex: index,
      form: mergeCreateForm(this.data.form, { backgroundMode }),
    })
  },

  handleCropInput(event) {
    const field = event.currentTarget.dataset.field
    if (!field) {
      return
    }

    const currentValue = this.data.crop[field]
    const nextValue = Number(event.detail.value)
    const patch = {}
    patch[field] = Number.isFinite(nextValue) ? nextValue : currentValue
    this.setData({
      crop: patchCropState(this.data.crop, patch),
    })
  },

  async handleGenerate() {
    if (this.data.isSubmitting) {
      return
    }

    if (!this.data.selectedImagePath) {
      wx.showToast({
        title: '请先选择图片',
        icon: 'none',
      })
      return
    }

    this.setData({
      isSubmitting: true,
      statusText: '正在上传图片并生成图纸...',
    })

    try {
      await ensureSession(false)
      const asset = await uploadAsset(this.data.selectedImagePath)
      const project = await createProject({
        title: `拼豆作品 ${Date.now()}`,
        sourceImageUrl: asset.url,
      })
      const version = await generateProject(project.id, buildGeneratePayload(this.data.form))

      this.setData({
        statusText: '生成完成，正在打开编辑页。',
      })

      wx.navigateTo({
        url: `/pages/editor/index?projectId=${project.id}&versionId=${version.id}`,
      })
    } catch (error) {
      wx.showToast({
        title: toErrorMessage(error),
        icon: 'none',
      })
      this.setData({
        statusText: '生成失败，请检查本地 API 是否已启动。',
      })
    } finally {
      this.setData({
        isSubmitting: false,
      })
    }
  },
})
