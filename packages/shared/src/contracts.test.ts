import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assertReservedPaletteSlot,
  defaultGenerateParams,
  generateParamsSchema,
} from './index.ts'

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

describe('assertReservedPaletteSlot', () => {
  it('accepts palette whose slot 0 is reserved and other slots are beads', () => {
    assert.doesNotThrow(() => {
      assertReservedPaletteSlot([
        { kind: 'background', hex: '#ffffff' },
        { kind: 'bead', hex: '#000000', code: 'M5' },
      ])
    })
  })

  it('rejects palette whose slot 0 is not reserved kind', () => {
    assert.throws(() => {
      assertReservedPaletteSlot([{ kind: 'bead', hex: '#ffffff' }])
    })
  })

  it('rejects palette with reserved kind outside slot 0', () => {
    assert.throws(() => {
      assertReservedPaletteSlot([
        { kind: 'blank', hex: '#ffffff' },
        { kind: 'background', hex: '#000000' },
      ])
    })
  })
})
