import test from 'node:test'
import assert from 'node:assert/strict'
import { generatePattern } from './generate-pattern.ts'

test('generatePattern reserves palette slot 0 for blank when backgroundMode is remove', async () => {
  const result = await generatePattern({
    imageBuffer: Buffer.from([137, 80, 78, 71]),
    gridWidth: 8,
    gridHeight: 8,
    colorCount: 4,
    detailLevel: 'medium',
    backgroundMode: 'remove',
  })

  assert.equal(result.palette[0]?.kind, 'blank')
  assert.equal(result.colorStats.every((item) => item.paletteIndex !== 0), true)
  assert.equal(result.colorStats.some((item) => item.paletteIndex === 0), false)
})

test('generatePattern keeps background in stats when backgroundMode is keep', async () => {
  const result = await generatePattern({
    imageBuffer: Buffer.from([137, 80, 78, 71]),
    gridWidth: 8,
    gridHeight: 8,
    colorCount: 4,
    detailLevel: 'medium',
    backgroundMode: 'keep',
  })

  assert.equal(result.palette[0]?.kind, 'background')
  assert.equal(result.cells.some((cell) => cell === 0), true)
  assert.equal(result.colorStats.some((item) => item.paletteIndex === 0), true)
})
