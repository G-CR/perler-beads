import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { generatePattern } from './generate-pattern.ts'

async function createSolidImageBuffer(hex: string): Promise<Buffer> {
  const rgb = hex
    .replace('#', '')
    .match(/.{1,2}/g)
    ?.map(part => Number.parseInt(part, 16))

  assert.ok(rgb)

  const pixels = Buffer.alloc(8 * 8 * 3)
  for (let i = 0; i < pixels.length; i += 3) {
    pixels[i] = rgb[0] ?? 0
    pixels[i + 1] = rgb[1] ?? 0
    pixels[i + 2] = rgb[2] ?? 0
  }

  return sharp(pixels, {
    raw: {
      width: 8,
      height: 8,
      channels: 3,
    },
  })
    .png()
    .toBuffer()
}

async function createStructuredImageBuffer(): Promise<Buffer> {
  const width = 16
  const height = 16
  const pixels = Buffer.alloc(width * height * 3, 255)

  const setPixel = (x: number, y: number, [r, g, b]: [number, number, number]) => {
    const offset = (y * width + x) * 3
    pixels[offset] = r
    pixels[offset + 1] = g
    pixels[offset + 2] = b
  }

  for (let y = 8; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(x, y, [18, 18, 18])
    }
  }

  for (let y = 10; y < 14; y += 1) {
    for (let x = 6; x < 10; x += 1) {
      setPixel(x, y, [220, 32, 32])
    }
  }

  return sharp(pixels, {
    raw: {
      width,
      height,
      channels: 3,
    },
  })
    .png()
    .toBuffer()
}

async function createCenteredPatchImageBuffer(
  patchHex: string,
  backgroundHex = '#ffffff',
): Promise<Buffer> {
  const width = 8
  const height = 8
  const pixels = Buffer.alloc(width * height * 3)
  const backgroundRgb = backgroundHex
    .replace('#', '')
    .match(/.{1,2}/g)
    ?.map(part => Number.parseInt(part, 16))
  const patchRgb = patchHex
    .replace('#', '')
    .match(/.{1,2}/g)
    ?.map(part => Number.parseInt(part, 16))

  assert.ok(backgroundRgb)
  assert.ok(patchRgb)

  for (let i = 0; i < pixels.length; i += 3) {
    pixels[i] = backgroundRgb[0] ?? 255
    pixels[i + 1] = backgroundRgb[1] ?? 255
    pixels[i + 2] = backgroundRgb[2] ?? 255
  }

  for (let y = 2; y < 6; y += 1) {
    for (let x = 2; x < 6; x += 1) {
      const offset = (y * width + x) * 3
      pixels[offset] = patchRgb[0] ?? 0
      pixels[offset + 1] = patchRgb[1] ?? 0
      pixels[offset + 2] = patchRgb[2] ?? 0
    }
  }

  return sharp(pixels, {
    raw: {
      width,
      height,
      channels: 3,
    },
  })
    .png()
    .toBuffer()
}

function dominantPaletteIndex(cells: number[]): { paletteIndex: number; count: number } {
  const counts = new Map<number, number>()

  for (const cell of cells) {
    counts.set(cell, (counts.get(cell) ?? 0) + 1)
  }

  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]
  assert.ok(ranked)

  return {
    paletteIndex: ranked[0],
    count: ranked[1],
  }
}

test('generatePattern reserves palette slot 0 for blank when backgroundMode is remove', async () => {
  const imageBuffer = await createSolidImageBuffer('#ffffff')
  const result = await generatePattern({
    imageBuffer,
    gridWidth: 8,
    gridHeight: 8,
    colorCount: 4,
    detailLevel: 'medium',
    backgroundMode: 'remove',
  })

  assert.equal(result.palette[0]?.kind, 'blank')
  assert.equal(result.colorStats.every((item) => item.paletteIndex !== 0), true)
  assert.equal(result.colorStats.some((item) => item.paletteIndex === 0), false)
  assert.equal(Buffer.isBuffer(result.previewBuffer), true)
})

test('generatePattern keeps background in stats when backgroundMode is keep', async () => {
  const imageBuffer = await createSolidImageBuffer('#ffffff')
  const result = await generatePattern({
    imageBuffer,
    gridWidth: 8,
    gridHeight: 8,
    colorCount: 4,
    detailLevel: 'medium',
    backgroundMode: 'keep',
  })

  assert.equal(result.palette[0]?.kind, 'background')
  assert.equal(result.cells.some((cell) => cell === 0), true)
  assert.equal(result.colorStats.some((item) => item.paletteIndex === 0), true)
  assert.equal(Buffer.isBuffer(result.previewBuffer), true)
})

test('generatePattern preserves the main structure of a white-background subject', async () => {
  const imageBuffer = await createStructuredImageBuffer()
  const result = await generatePattern({
    imageBuffer,
    gridWidth: 16,
    gridHeight: 16,
    colorCount: 3,
    detailLevel: 'high',
    backgroundMode: 'keep',
  })

  const topHalf = result.cells.slice(0, 16 * 8)
  const bottomHalf = result.cells.slice(16 * 8)
  const redRegion: number[] = []
  const darkRegion: number[] = []

  for (let y = 8; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const cell = result.cells[y * 16 + x]
      const inRedRegion = x >= 6 && x < 10 && y >= 10 && y < 14
      if (inRedRegion) {
        redRegion.push(cell)
        continue
      }
      darkRegion.push(cell)
    }
  }

  const backgroundCount = topHalf.filter(cell => cell === 0).length
  const darkDominant = dominantPaletteIndex(darkRegion.filter(cell => cell !== 0))
  const redDominant = dominantPaletteIndex(redRegion.filter(cell => cell !== 0))

  assert.equal(result.palette[0]?.kind, 'background')
  assert.ok(backgroundCount >= 120, `expected white background to remain mostly blank, got ${backgroundCount}`)
  assert.ok(bottomHalf.filter(cell => cell !== 0).length >= 100)
  assert.ok(darkDominant.count >= 90)
  assert.ok(redDominant.count >= 12)
  assert.notEqual(redDominant.paletteIndex, darkDominant.paletteIndex)
})

test('generatePattern quantizes bead colors to MARD 221 palette entries', async () => {
  const imageBuffer = await createCenteredPatchImageBuffer('#c91f37')
  const result = await generatePattern({
    imageBuffer,
    gridWidth: 8,
    gridHeight: 8,
    colorCount: 3,
    detailLevel: 'high',
    backgroundMode: 'keep',
  })

  const beadPalette = result.palette.filter(item => item.kind === 'bead')

  assert.ok(beadPalette.every(item => typeof item.code === 'string' && item.code.length > 0))
  assert.ok(beadPalette.some(item => item.code === 'M7' && item.hex.toLowerCase() === '#c91f37'))
})
