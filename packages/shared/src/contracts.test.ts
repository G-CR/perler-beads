import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { defaultGenerateParams, generateParamsSchema } from './index.ts'

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

describe('generateParamsSchema', () => {
  it('accepts the default parameters', () => {
    const parsed = generateParamsSchema.parse(defaultGenerateParams())
    assert.equal(parsed.gridWidth, 64)
    assert.equal(parsed.backgroundMode, 'keep')
  })

  it('rejects invalid dimensions', () => {
    assert.throws(() => {
      generateParamsSchema.parse({
        ...defaultGenerateParams(),
        gridWidth: 7,
      })
    })
  })
})
