import test from 'node:test'
import assert from 'node:assert/strict'
import { generatePattern } from './generate-pattern.ts'

test('generatePattern reserves palette slot 0 for background', async () => {
  const result = await generatePattern({
    imageBuffer: Buffer.from([137, 80, 78, 71]),
    gridWidth: 8,
    gridHeight: 8,
    colorCount: 4,
    detailLevel: 'medium',
    backgroundMode: 'remove',
  })

  assert.equal(result.palette[0]?.kind, 'background')
  assert.equal(result.colorStats.every((item) => item.paletteIndex !== 0), true)
})
