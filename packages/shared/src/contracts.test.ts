import { describe, expect, it } from 'vitest'
import { defaultGenerateParams } from './contracts'

describe('defaultGenerateParams', () => {
  it('starts with a square grid and palette-limited defaults', () => {
    expect(defaultGenerateParams()).toMatchObject({
      gridWidth: 64,
      gridHeight: 64,
      colorCount: 16,
      detailLevel: 'medium',
      backgroundMode: 'keep',
    })
  })
})
