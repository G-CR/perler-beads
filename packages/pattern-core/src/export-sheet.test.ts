import test from 'node:test'
import assert from 'node:assert/strict'
import { renderExportSheet } from './export-sheet.ts'

test('renderExportSheet excludes background slot from exported stats', async () => {
  const buffer = await renderExportSheet({
    width: 2,
    height: 2,
    cells: [0, 1, 2, 0],
    palette: [
      { kind: 'background', hex: '#000000' },
      { kind: 'bead', hex: '#ff0000' },
      { kind: 'bead', hex: '#00ff00' },
    ],
    colorStats: [
      { paletteIndex: 0, count: 2 },
      { paletteIndex: 1, count: 1 },
      { paletteIndex: 2, count: 1 },
    ],
  })

  const parsed = JSON.parse(buffer.toString('utf8')) as {
    stats: Array<{ paletteIndex: number; count: number }>
  }

  assert.deepStrictEqual(parsed.stats, [
    { paletteIndex: 1, count: 1 },
    { paletteIndex: 2, count: 1 },
  ])
})
