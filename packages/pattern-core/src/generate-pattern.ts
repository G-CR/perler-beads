import sharp from 'sharp'
import { assertReservedPaletteSlot } from '@perler/shared'
import type {
  ColorStat,
  GeneratePatternInput,
  PaletteItem,
  PatternResult,
  ReservedPalette,
} from './types.ts'
import { MARD221_PALETTE, type Mard221PaletteEntry } from './mard221-palette.ts'

type RgbColor = {
  r: number
  g: number
  b: number
}

type RgbaPixel = RgbColor & {
  a: number
}

function buildPaletteWithBackground(
  representativeColors: Mard221PaletteEntry[],
  mode: GeneratePatternInput['backgroundMode'],
  backgroundColor: RgbColor,
): ReservedPalette {
  const palette: PaletteItem[] = [
    {
      kind: mode === 'keep' ? 'background' : 'blank',
      hex: mode === 'keep' ? rgbToHex(backgroundColor) : '#ffffff',
    },
  ]
  for (const color of representativeColors) {
    palette.push({
      kind: 'bead',
      hex: color.hex,
      code: color.code,
    })
  }
  assertReservedPaletteSlot(palette)
  return palette
}

function rgbToHex(color: RgbColor): string {
  const encode = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
  return `#${encode(color.r)}${encode(color.g)}${encode(color.b)}`
}

function toRgb(pixel: RgbaPixel): RgbColor {
  return { r: pixel.r, g: pixel.g, b: pixel.b }
}

function colorDistance(left: RgbColor, right: RgbColor): number {
  return Math.hypot(left.r - right.r, left.g - right.g, left.b - right.b)
}

function luminance(color: RgbColor): number {
  return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722
}

function saturation(color: RgbColor): number {
  const max = Math.max(color.r, color.g, color.b)
  const min = Math.min(color.r, color.g, color.b)
  if (max === 0) {
    return 0
  }
  return (max - min) / max
}

function averageColor(colors: RgbColor[]): RgbColor {
  if (colors.length === 0) {
    return { r: 255, g: 255, b: 255 }
  }

  const totals = colors.reduce(
    (accumulator, color) => ({
      r: accumulator.r + color.r,
      g: accumulator.g + color.g,
      b: accumulator.b + color.b,
    }),
    { r: 0, g: 0, b: 0 },
  )

  return {
    r: totals.r / colors.length,
    g: totals.g / colors.length,
    b: totals.b / colors.length,
  }
}

function estimateBackgroundColor(
  pixels: RgbaPixel[],
  width: number,
  height: number,
): RgbColor {
  const samples: RgbColor[] = []

  for (let x = 0; x < width; x += 1) {
    const top = pixels[x]
    const bottom = pixels[(height - 1) * width + x]
    if (top && top.a > 16) {
      samples.push(toRgb(top))
    }
    if (bottom && bottom.a > 16) {
      samples.push(toRgb(bottom))
    }
  }

  for (let y = 1; y < height - 1; y += 1) {
    const left = pixels[y * width]
    const right = pixels[y * width + width - 1]
    if (left && left.a > 16) {
      samples.push(toRgb(left))
    }
    if (right && right.a > 16) {
      samples.push(toRgb(right))
    }
  }

  return averageColor(samples)
}

function isBackgroundPixel(pixel: RgbaPixel, backgroundColor: RgbColor): boolean {
  if (pixel.a <= 16) {
    return true
  }

  const color = toRgb(pixel)
  const luma = luminance(color)
  const backgroundLuma = luminance(backgroundColor)
  const closeToBorderColor =
    colorDistance(color, backgroundColor) <= 42 &&
    Math.abs(luma - backgroundLuma) <= 28
  const brightNeutral = luma >= 244 && saturation(color) <= 0.08

  return closeToBorderColor || brightNeutral
}

function kernelForDetailLevel(detailLevel: GeneratePatternInput['detailLevel']) {
  switch (detailLevel) {
    case 'low':
      return sharp.kernel.nearest
    case 'high':
      return sharp.kernel.lanczos3
    case 'medium':
    default:
      return sharp.kernel.mitchell
  }
}

async function decodeIntoGridPixels(input: GeneratePatternInput): Promise<RgbaPixel[]> {
  const { data } = await sharp(input.imageBuffer)
    .rotate()
    .resize(input.gridWidth, input.gridHeight, {
      fit: 'fill',
      kernel: kernelForDetailLevel(input.detailLevel),
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels: RgbaPixel[] = []
  for (let i = 0; i < data.length; i += 4) {
    pixels.push({
      r: data[i] ?? 0,
      g: data[i + 1] ?? 0,
      b: data[i + 2] ?? 0,
      a: data[i + 3] ?? 255,
    })
  }

  return pixels
}

function buildColorBuckets(pixels: RgbaPixel[]): Array<{ color: RgbColor; count: number }> {
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>()

  for (const pixel of pixels) {
    const key = ((pixel.r >> 4) << 8) | ((pixel.g >> 4) << 4) | (pixel.b >> 4)
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
    bucket.count += 1
    bucket.r += pixel.r
    bucket.g += pixel.g
    bucket.b += pixel.b
    buckets.set(key, bucket)
  }

  return [...buckets.values()]
    .map(bucket => ({
      color: {
        r: bucket.r / bucket.count,
        g: bucket.g / bucket.count,
        b: bucket.b / bucket.count,
      },
      count: bucket.count,
    }))
    .sort((left, right) => right.count - left.count)
}

function chooseInitialCenters(
  buckets: Array<{ color: RgbColor; count: number }>,
  targetCount: number,
): RgbColor[] {
  if (targetCount === 0 || buckets.length === 0) {
    return []
  }

  const centers: RgbColor[] = [buckets[0].color]
  while (centers.length < Math.min(targetCount, buckets.length)) {
    let bestBucket: { color: RgbColor; count: number } | undefined
    let bestScore = Number.NEGATIVE_INFINITY

    for (const bucket of buckets) {
      const minDistance = Math.min(...centers.map(center => colorDistance(center, bucket.color)))
      const score = minDistance * bucket.count
      if (score > bestScore) {
        bestScore = score
        bestBucket = bucket
      }
    }

    if (!bestBucket || centers.some(center => colorDistance(center, bestBucket.color) < 1)) {
      break
    }

    centers.push(bestBucket.color)
  }

  return centers
}

function nearestColorIndex(color: RgbColor, palette: RgbColor[]): number {
  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY

  for (let i = 0; i < palette.length; i += 1) {
    const distance = colorDistance(color, palette[i]!)
    if (distance < nearestDistance) {
      nearestIndex = i
      nearestDistance = distance
    }
  }

  return nearestIndex
}

function nearestPaletteEntry<T extends { rgb: RgbColor }>(color: RgbColor, palette: T[]): T {
  let nearest = palette[0]!
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const entry of palette) {
    const distance = colorDistance(color, entry.rgb)
    if (distance < nearestDistance) {
      nearest = entry
      nearestDistance = distance
    }
  }

  return nearest
}

function rankedPaletteEntries<T extends { rgb: RgbColor }>(color: RgbColor, palette: T[]): T[] {
  return [...palette].sort(
    (left, right) => colorDistance(color, left.rgb) - colorDistance(color, right.rgb),
  )
}

function refineRepresentativeColors(pixels: RgbaPixel[], initialCenters: RgbColor[]): RgbColor[] {
  if (initialCenters.length === 0) {
    return []
  }

  let centers = initialCenters.map(center => ({ ...center }))

  for (let iteration = 0; iteration < 6; iteration += 1) {
    const sums = centers.map(() => ({ r: 0, g: 0, b: 0, count: 0 }))
    let hasMovement = false

    for (const pixel of pixels) {
      const index = nearestColorIndex(toRgb(pixel), centers)
      const slot = sums[index]
      slot.r += pixel.r
      slot.g += pixel.g
      slot.b += pixel.b
      slot.count += 1
    }

    centers = centers.map((center, index) => {
      const slot = sums[index]
      if (!slot || slot.count === 0) {
        return center
      }

      const nextCenter = {
        r: slot.r / slot.count,
        g: slot.g / slot.count,
        b: slot.b / slot.count,
      }

      if (colorDistance(center, nextCenter) >= 1) {
        hasMovement = true
      }

      return nextCenter
    })

    if (!hasMovement) {
      break
    }
  }

  return centers
}

function countNearestMardUsage(
  pixels: RgbaPixel[],
): Array<{ entry: Mard221PaletteEntry; count: number }> {
  const counter = new Map<string, { entry: Mard221PaletteEntry; count: number }>()

  for (const pixel of pixels) {
    const nearest = nearestPaletteEntry(toRgb(pixel), MARD221_PALETTE)
    const current = counter.get(nearest.code) ?? { entry: nearest, count: 0 }
    current.count += 1
    counter.set(nearest.code, current)
  }

  return [...counter.values()].sort(
    (left, right) => right.count - left.count || left.entry.code.localeCompare(right.entry.code),
  )
}

function selectMardRepresentativeColors(input: {
  foregroundPixels: RgbaPixel[]
  representativeColors: RgbColor[]
  colorCount: number
}): Mard221PaletteEntry[] {
  const usageRanking = countNearestMardUsage(input.foregroundPixels)
  if (usageRanking.length === 0 || input.colorCount === 0) {
    return []
  }

  const targetCount = Math.min(input.colorCount, usageRanking.length)
  const selected: Mard221PaletteEntry[] = []
  const selectedCodes = new Set<string>()

  for (const color of input.representativeColors) {
    const nearestUnused = rankedPaletteEntries(color, MARD221_PALETTE).find(
      entry => !selectedCodes.has(entry.code),
    )
    if (!nearestUnused) {
      continue
    }

    selected.push(nearestUnused)
    selectedCodes.add(nearestUnused.code)

    if (selected.length >= targetCount) {
      return selected
    }
  }

  for (const usage of usageRanking) {
    if (selectedCodes.has(usage.entry.code)) {
      continue
    }

    selected.push(usage.entry)
    selectedCodes.add(usage.entry.code)

    if (selected.length >= targetCount) {
      break
    }
  }

  return selected
}

async function quantizeIntoGrid(input: GeneratePatternInput): Promise<{
  cells: number[]
  representativeColors: Mard221PaletteEntry[]
  backgroundColor: RgbColor
}> {
  const pixels = await decodeIntoGridPixels(input)
  const backgroundColor = estimateBackgroundColor(pixels, input.gridWidth, input.gridHeight)
  const backgroundMask = pixels.map(pixel => isBackgroundPixel(pixel, backgroundColor))
  const foregroundPixels = pixels.filter((_, index) => !backgroundMask[index])

  let representativeColors: Mard221PaletteEntry[] = []
  if (foregroundPixels.length > 0) {
    const buckets = buildColorBuckets(foregroundPixels)
    const initialCenters = chooseInitialCenters(buckets, input.colorCount)
    const refinedColors = refineRepresentativeColors(foregroundPixels, initialCenters)
    const dynamicPalette =
      refinedColors.length > 0 ? refinedColors : [averageColor(foregroundPixels.map(toRgb))]
    representativeColors = selectMardRepresentativeColors({
      foregroundPixels,
      representativeColors: dynamicPalette,
      colorCount: input.colorCount,
    })
  }

  const cells = pixels.map((pixel, index) => {
    if (backgroundMask[index]) {
      return 0
    }
    if (representativeColors.length === 0) {
      return 0
    }
    return nearestColorIndex(
      toRgb(pixel),
      representativeColors.map(color => color.rgb),
    ) + 1
  })

  return {
    cells,
    representativeColors,
    backgroundColor,
  }
}

function countBeads(
  cells: number[],
  options: { excludePaletteIndex?: number } = {},
): ColorStat[] {
  const counter = new Map<number, number>()
  for (const cell of cells) {
    if (options.excludePaletteIndex !== undefined && cell === options.excludePaletteIndex) {
      continue
    }
    counter.set(cell, (counter.get(cell) ?? 0) + 1)
  }

  return [...counter.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([paletteIndex, count]) => ({ paletteIndex, count }))
}

async function renderPreviewBuffer(input: {
  width: number
  height: number
  cells: number[]
  palette: ReservedPalette
}): Promise<Buffer> {
  const payload = JSON.stringify({
    width: input.width,
    height: input.height,
    cells: input.cells,
    palette: input.palette,
  })
  return Buffer.from(payload, 'utf8')
}

export async function generatePattern(input: GeneratePatternInput): Promise<PatternResult> {
  const { cells, representativeColors, backgroundColor } = await quantizeIntoGrid(input)
  const palette = buildPaletteWithBackground(
    representativeColors,
    input.backgroundMode,
    backgroundColor,
  )
  assertReservedPaletteSlot(palette)
  const colorStats = countBeads(cells, {
    excludePaletteIndex: palette[0]?.kind === 'blank' ? 0 : undefined,
  })

  return {
    width: input.gridWidth,
    height: input.gridHeight,
    cells,
    palette,
    colorStats,
    previewBuffer: await renderPreviewBuffer({
      width: input.gridWidth,
      height: input.gridHeight,
      cells,
      palette,
    }),
  }
}
