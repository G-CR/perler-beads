export type CropState = {
  x: number
  y: number
  width: number
  height: number
  scale: number
}

export function defaultCropState(): CropState {
  return {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    scale: 1,
  }
}

export function patchCropState(
  current: CropState,
  patch: Partial<CropState>,
): CropState {
  const next = {
    ...current,
    ...patch,
  }

  return {
    x: Math.max(0, next.x),
    y: Math.max(0, next.y),
    width: Math.max(0.1, next.width),
    height: Math.max(0.1, next.height),
    scale: Math.max(0.1, next.scale),
  }
}
