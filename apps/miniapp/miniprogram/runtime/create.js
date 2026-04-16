const DEFAULT_CREATE_FORM = {
  gridWidth: 64,
  gridHeight: 64,
  colorCount: 16,
  detailLevel: 'medium',
  backgroundMode: 'keep',
}

function defaultCreateForm() {
  return Object.assign({}, DEFAULT_CREATE_FORM)
}

function mergeCreateForm(current, patch) {
  return Object.assign({}, current, patch)
}

function buildGeneratePayload(input) {
  const payload = {
    gridWidth: Number(input.gridWidth),
    gridHeight: Number(input.gridHeight),
    colorCount: Number(input.colorCount),
    detailLevel: input.detailLevel,
    backgroundMode: input.backgroundMode,
  }

  if (!Number.isInteger(payload.gridWidth) || payload.gridWidth < 8 || payload.gridWidth > 256) {
    throw new Error('gridWidth out of range')
  }
  if (!Number.isInteger(payload.gridHeight) || payload.gridHeight < 8 || payload.gridHeight > 256) {
    throw new Error('gridHeight out of range')
  }
  if (!Number.isInteger(payload.colorCount) || payload.colorCount < 2 || payload.colorCount > 64) {
    throw new Error('colorCount out of range')
  }
  if (!['low', 'medium', 'high'].includes(payload.detailLevel)) {
    throw new Error('Invalid detailLevel')
  }
  if (!['keep', 'remove'].includes(payload.backgroundMode)) {
    throw new Error('Invalid backgroundMode')
  }

  return payload
}

function defaultCropState() {
  return {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    scale: 1,
  }
}

function patchCropState(current, patch) {
  const next = Object.assign({}, current, patch)
  return {
    x: Math.max(0, next.x),
    y: Math.max(0, next.y),
    width: Math.max(0.1, next.width),
    height: Math.max(0.1, next.height),
    scale: Math.max(0.1, next.scale),
  }
}

module.exports = {
  defaultCreateForm,
  mergeCreateForm,
  buildGeneratePayload,
  defaultCropState,
  patchCropState,
}
