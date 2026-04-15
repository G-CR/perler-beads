import type { ExportSheetInput } from './types.ts'

function renderSheetWithLegendAndStats(input: ExportSheetInput): Buffer {
  const stats = input.colorStats.filter((item) => {
    const paletteItem = input.palette[item.paletteIndex]
    return paletteItem?.kind !== 'background' && item.paletteIndex !== 0
  })

  return Buffer.from(
    JSON.stringify({
      width: input.width,
      height: input.height,
      stats,
    }),
    'utf8',
  )
}

export async function renderExportSheet(input: ExportSheetInput): Promise<Buffer> {
  return renderSheetWithLegendAndStats(input)
}
