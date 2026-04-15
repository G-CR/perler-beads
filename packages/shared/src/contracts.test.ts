import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { defaultGenerateParams } from './contracts.ts'

describe('defaultGenerateParams', () => {
  it('starts with a square grid and palette-limited defaults', () => {
    assert.deepStrictEqual(defaultGenerateParams(), {
      gridWidth: 64,
      gridHeight: 64,
      colorCount: 16,
      detailLevel: 'medium',
      backgroundMode: 'keep',
    })
  })
})
