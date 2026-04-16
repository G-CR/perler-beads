import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { collectExportStats, renderExportSheet } from './export-sheet.ts'

async function readPixel(buffer: Buffer, x: number, y: number): Promise<[number, number, number, number]> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const offset = (y * info.width + x) * info.channels
  return [
    data[offset] ?? 0,
    data[offset + 1] ?? 0,
    data[offset + 2] ?? 0,
    data[offset + 3] ?? 0,
  ]
}

test('collectExportStats excludes blank slot from exported stats', () => {
  const stats = collectExportStats({
    palette: [
      { kind: 'blank', hex: '#000000' },
      { kind: 'bead', hex: '#ff0000' },
      { kind: 'bead', hex: '#00ff00' },
    ],
    colorStats: [
      { paletteIndex: 0, count: 2 },
      { paletteIndex: 1, count: 1 },
      { paletteIndex: 2, count: 1 },
    ],
  })

  assert.deepStrictEqual(stats, [
    { paletteIndex: 1, count: 1 },
    { paletteIndex: 2, count: 1 },
  ])
})

test('renderExportSheet returns a PNG buffer', async () => {
  const buffer = await renderExportSheet({
    width: 2,
    height: 2,
    cells: [0, 1, 2, 0],
    palette: [
      { kind: 'background', hex: '#ffffff' },
      { kind: 'bead', hex: '#ff0000' },
      { kind: 'bead', hex: '#00ff00' },
    ],
    colorStats: [
      { paletteIndex: 0, count: 2 },
      { paletteIndex: 1, count: 1 },
      { paletteIndex: 2, count: 1 },
    ],
  })

  assert.deepStrictEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])

  const metadata = await sharp(buffer).metadata()
  assert.equal(metadata.format, 'png')
  assert.ok((metadata.width ?? 0) > 0)
  assert.ok((metadata.height ?? 0) > 0)
})

test('renderExportSheet keeps colored cells visible under the grid overlay', async () => {
  const buffer = await renderExportSheet({
    width: 2,
    height: 2,
    cells: [0, 1, 2, 0],
    palette: [
      { kind: 'background', hex: '#ffffff' },
      { kind: 'bead', hex: '#ff0000' },
      { kind: 'bead', hex: '#00ff00' },
    ],
    colorStats: [
      { paletteIndex: 0, count: 2 },
      { paletteIndex: 1, count: 1 },
      { paletteIndex: 2, count: 1 },
    ],
  })

  const redCellCenter = await readPixel(buffer, 32 + 18 + 9, 32 + 84 + 9)

  assert.ok(redCellCenter[0] > 220, `expected red cell to remain visible, got ${redCellCenter.join(',')}`)
  assert.ok(redCellCenter[1] < 120, `expected red cell not to be washed out, got ${redCellCenter.join(',')}`)
  assert.ok(redCellCenter[2] < 120, `expected red cell not to be washed out, got ${redCellCenter.join(',')}`)
})

test('collectExportStats keeps background slot stats when palette slot 0 is background', () => {
  const stats = collectExportStats({
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

  assert.deepStrictEqual(stats, [
    { paletteIndex: 0, count: 2 },
    { paletteIndex: 1, count: 1 },
    { paletteIndex: 2, count: 1 },
  ])
})

test('renderExportSheet rejects palette with reserved slot not at index 0', async () => {
  await assert.rejects(async () => {
    await renderExportSheet({
      width: 2,
      height: 2,
      cells: [0, 1, 2, 0],
      palette: [
        { kind: 'bead', hex: '#000000' },
        { kind: 'background', hex: '#ff0000' },
        { kind: 'bead', hex: '#00ff00' },
      ],
      colorStats: [
        { paletteIndex: 0, count: 2 },
        { paletteIndex: 1, count: 1 },
        { paletteIndex: 2, count: 1 },
      ],
    })
  })
})
