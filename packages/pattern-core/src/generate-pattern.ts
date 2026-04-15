import type {
  ColorStat,
  GeneratePatternInput,
  PaletteItem,
  PatternResult,
} from './types.ts'

const BASE_PALETTE = [
  '#f94144',
  '#f3722c',
  '#f9c74f',
  '#90be6d',
  '#43aa8b',
  '#577590',
  '#277da1',
  '#6a4c93',
]

function buildPaletteWithBackground(colorCount: number): PaletteItem[] {
  const palette: PaletteItem[] = [{ kind: 'background', hex: '#ffffff' }]
  for (let i = 0; i < colorCount; i += 1) {
    palette.push({
      kind: 'bead',
      hex: BASE_PALETTE[i % BASE_PALETTE.length],
    })
  }
  return palette
}

function quantizeIntoGrid(input: GeneratePatternInput, palette: PaletteItem[]): number[] {
  const { gridWidth, gridHeight, imageBuffer } = input
  const size = gridWidth * gridHeight
  const beadSlots = Math.max(1, palette.length - 1)
  const cells: number[] = new Array(size)

  for (let i = 0; i < size; i += 1) {
    const source = imageBuffer[i % Math.max(1, imageBuffer.length)] ?? 0
    cells[i] = (source % beadSlots) + 1
  }

  return cells
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

async function renderPreviewPng(input: {
  width: number
  height: number
  cells: number[]
  palette: PaletteItem[]
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
  const palette = buildPaletteWithBackground(input.colorCount)
  const cells = quantizeIntoGrid(input, palette)
  const colorStats = countBeads(cells, {
    excludePaletteIndex: input.backgroundMode === 'remove' ? 0 : undefined,
  })

  return {
    width: input.gridWidth,
    height: input.gridHeight,
    cells,
    palette,
    colorStats,
    previewPng: await renderPreviewPng({
      width: input.gridWidth,
      height: input.gridHeight,
      cells,
      palette,
    }),
  }
}
