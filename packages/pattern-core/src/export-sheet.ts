import sharp from 'sharp'
import { assertReservedPaletteSlot } from '@perler/shared'
import type { ColorStat, ExportSheetInput, PaletteItem } from './types.ts'

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

type RgbColor = {
  r: number
  g: number
  b: number
}

type SheetLayout = {
  pageWidth: number
  pageHeight: number
  padding: number
  headerHeight: number
  gridLeft: number
  gridTop: number
  gridPixelWidth: number
  gridPixelHeight: number
  legendLeft: number
  legendWidth: number
  cellSize: number
}

export function collectExportStats(input: Pick<ExportSheetInput, 'palette' | 'colorStats'>): ColorStat[] {
  assertReservedPaletteSlot(input.palette)
  const shouldExcludeSlot0 = input.palette[0]?.kind === 'blank'

  return input.colorStats.filter((item) => {
    if (shouldExcludeSlot0 && item.paletteIndex === 0) {
      return false
    }
    return true
  })
}

function parseHexColor(hex: string): RgbColor {
  const normalized = /^#[\da-fA-F]{6}$/.test(hex) ? hex : '#ffffff'

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  }
}

function escapeXml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function resolveCellColor(palette: PaletteItem[], paletteIndex: number): RgbColor {
  const paletteItem = palette[paletteIndex] ?? palette[0] ?? { kind: 'background', hex: '#ffffff' }
  return parseHexColor(paletteItem.hex)
}

function buildGridRaster(input: ExportSheetInput): Buffer {
  const raster = Buffer.alloc(input.width * input.height * 4)

  for (let index = 0; index < input.width * input.height; index += 1) {
    const color = resolveCellColor(input.palette, input.cells[index] ?? 0)
    const offset = index * 4
    raster[offset] = color.r
    raster[offset + 1] = color.g
    raster[offset + 2] = color.b
    raster[offset + 3] = 255
  }

  return raster
}

function computeLayout(input: ExportSheetInput, statsCount: number): SheetLayout {
  const padding = 32
  const headerHeight = 84
  const legendWidth = 300
  const maxGridPixels = 720
  const cellSize = Math.max(4, Math.min(18, Math.floor(maxGridPixels / Math.max(input.width, input.height)) || 4))
  const gridPixelWidth = input.width * cellSize
  const gridPixelHeight = input.height * cellSize
  const legendContentHeight = 96 + Math.max(1, statsCount) * 32
  const pageWidth = padding * 3 + gridPixelWidth + legendWidth
  const pageHeight = padding * 2 + headerHeight + Math.max(gridPixelHeight, legendContentHeight)

  return {
    pageWidth,
    pageHeight,
    padding,
    headerHeight,
    gridLeft: padding,
    gridTop: padding + headerHeight,
    gridPixelWidth,
    gridPixelHeight,
    legendLeft: padding * 2 + gridPixelWidth,
    legendWidth,
    cellSize,
  }
}

function buildGridLines(input: ExportSheetInput, layout: SheetLayout): string {
  const step = layout.cellSize >= 8 ? 1 : 5
  const lines: string[] = []

  for (let column = 0; column <= input.width; column += step) {
    const x = layout.gridLeft + column * layout.cellSize
    const major = column % 10 === 0
    lines.push(
      `<line x1="${x}" y1="${layout.gridTop}" x2="${x}" y2="${layout.gridTop + layout.gridPixelHeight}" stroke="${major ? '#c8ced6' : '#dde2e9'}" stroke-width="${major ? 1.2 : 1}" />`,
    )
  }

  for (let row = 0; row <= input.height; row += step) {
    const y = layout.gridTop + row * layout.cellSize
    const major = row % 10 === 0
    lines.push(
      `<line x1="${layout.gridLeft}" y1="${y}" x2="${layout.gridLeft + layout.gridPixelWidth}" y2="${y}" stroke="${major ? '#c8ced6' : '#dde2e9'}" stroke-width="${major ? 1.2 : 1}" />`,
    )
  }

  return lines.join('')
}

function buildLegendRows(
  input: ExportSheetInput,
  stats: ColorStat[],
  layout: SheetLayout,
): string {
  const totalBeads = input.width * input.height

  if (stats.length === 0) {
    return `<text x="${layout.legendLeft + 24}" y="${layout.gridTop + 96}" font-family="Arial, sans-serif" font-size="15" fill="#6b7280">No visible bead stats</text>`
  }

  return stats
    .map((stat, index) => {
      const paletteItem = input.palette[stat.paletteIndex] ?? input.palette[0]!
      const y = layout.gridTop + 84 + index * 32
      const slotLabel =
        paletteItem.code ??
        (stat.paletteIndex === 0 && paletteItem.kind === 'background'
          ? 'BG'
          : `#${String(stat.paletteIndex).padStart(2, '0')}`)
      const percentage = ((stat.count / Math.max(1, totalBeads)) * 100).toFixed(1)

      return [
        `<rect x="${layout.legendLeft + 24}" y="${y - 14}" width="18" height="18" rx="4" fill="${escapeXml(
          paletteItem.hex,
        )}" stroke="${paletteItem.kind === 'blank' ? '#9ca3af' : '#d1d5db'}" stroke-width="1.5" />`,
        `<text x="${layout.legendLeft + 54}" y="${y}" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#111827">${escapeXml(
          slotLabel,
        )}</text>`,
        `<text x="${layout.legendLeft + 104}" y="${y}" font-family="Arial, sans-serif" font-size="14" fill="#4b5563">${stat.count} beads</text>`,
        `<text x="${layout.legendLeft + layout.legendWidth - 24}" y="${y}" text-anchor="end" font-family="Arial, sans-serif" font-size="14" fill="#6b7280">${percentage}%</text>`,
      ].join('')
    })
    .join('')
}

function buildSheetOverlaySvg(
  input: ExportSheetInput,
  stats: ColorStat[],
  layout: SheetLayout,
): Buffer {
  const subtitle = `Grid ${input.width} x ${input.height}  Total ${input.width * input.height}`
  const note =
    input.palette[0]?.kind === 'blank'
      ? 'Blank cells are hidden from the stats panel.'
      : 'Background cells remain visible in the stats panel.'

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${layout.pageWidth}" height="${layout.pageHeight}" viewBox="0 0 ${layout.pageWidth} ${layout.pageHeight}">
      <text x="${layout.padding}" y="${layout.padding + 24}" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#111827">Perler Pattern Sheet</text>
      <text x="${layout.padding}" y="${layout.padding + 52}" font-family="Arial, sans-serif" font-size="15" fill="#4b5563">${escapeXml(
        subtitle,
      )}</text>

      <rect x="${layout.gridLeft - 2}" y="${layout.gridTop - 2}" width="${layout.gridPixelWidth + 4}" height="${layout.gridPixelHeight + 4}" rx="16" fill="none" stroke="#d8dee6" stroke-width="2" />
      ${buildGridLines(input, layout)}

      <rect x="${layout.legendLeft}" y="${layout.gridTop}" width="${layout.legendWidth}" height="${layout.pageHeight - layout.gridTop - layout.padding}" rx="20" fill="#ffffff" stroke="#e5e7eb" stroke-width="1.5" />
      <text x="${layout.legendLeft + 24}" y="${layout.gridTop + 32}" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#111827">Color Stats</text>
      <text x="${layout.legendLeft + 24}" y="${layout.gridTop + 56}" font-family="Arial, sans-serif" font-size="13" fill="#6b7280">${escapeXml(
        note,
      )}</text>
      ${buildLegendRows(input, stats, layout)}
    </svg>
  `

  return Buffer.from(svg, 'utf8')
}

async function renderSheetWithLegendAndStats(input: ExportSheetInput): Promise<Buffer> {
  assertReservedPaletteSlot(input.palette)
  const stats = collectExportStats(input)
  const layout = computeLayout(input, stats.length)
  const gridBuffer = buildGridRaster(input)
  const gridImage = await sharp(gridBuffer, {
    raw: {
      width: input.width,
      height: input.height,
      channels: 4,
    },
  })
    .resize(layout.gridPixelWidth, layout.gridPixelHeight, {
      kernel: sharp.kernel.nearest,
    })
    .png()
    .toBuffer()

  const sheet = await sharp({
    create: {
      width: layout.pageWidth,
      height: layout.pageHeight,
      channels: 4,
      background: '#f7f4ed',
    },
  })
    .composite([
      {
        input: gridImage,
        left: layout.gridLeft,
        top: layout.gridTop,
      },
      {
        input: buildSheetOverlaySvg(input, stats, layout),
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer()

  if (!PNG_SIGNATURE.every((value, index) => sheet[index] === value)) {
    throw new Error('INVALID_EXPORT_SHEET_BUFFER')
  }

  return sheet
}

export async function renderExportSheet(input: ExportSheetInput): Promise<Buffer> {
  return renderSheetWithLegendAndStats(input)
}
