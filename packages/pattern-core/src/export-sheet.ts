import { assertReservedPaletteSlot } from '@perler/shared'
import type { ExportSheetInput } from './types.ts'

function renderSheetWithLegendAndStats(input: ExportSheetInput): Buffer {
  assertReservedPaletteSlot(input.palette)
  const shouldExcludeSlot0 = input.palette[0]?.kind === 'blank'
  const stats = input.colorStats.filter((item) => {
    if (shouldExcludeSlot0 && item.paletteIndex === 0) {
      return false
    }
    return true
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
