import { z } from 'zod'

export const detailLevelSchema = z.enum(['low', 'medium', 'high'])
export const backgroundModeSchema = z.enum(['keep', 'remove'])

export const generateParamsSchema = z.object({
  gridWidth: z.number().int().min(8).max(256),
  gridHeight: z.number().int().min(8).max(256),
  colorCount: z.number().int().min(2).max(64),
  detailLevel: detailLevelSchema,
  backgroundMode: backgroundModeSchema,
})

export const defaultGenerateParams = () => ({
  gridWidth: 64,
  gridHeight: 64,
  colorCount: 16,
  detailLevel: 'medium' as const,
  backgroundMode: 'keep' as const,
})

export type DetailLevel = z.infer<typeof detailLevelSchema>
export type BackgroundMode = z.infer<typeof backgroundModeSchema>
export type GenerateParams = z.infer<typeof generateParamsSchema>

export type ReservedPaletteItem = {
  kind: 'background' | 'blank'
  hex: string
}

export type BeadPaletteItem = {
  kind: 'bead'
  hex: string
}

export type PaletteItem = ReservedPaletteItem | BeadPaletteItem

export type ReservedPalette = [ReservedPaletteItem, ...BeadPaletteItem[]]

export function assertReservedPaletteSlot(palette: PaletteItem[]): asserts palette is ReservedPalette {
  if (palette.length === 0) {
    throw new Error('Invalid palette: slot 0 is required and must be background or blank')
  }

  const slotZero = palette[0]
  if (slotZero.kind !== 'background' && slotZero.kind !== 'blank') {
    throw new Error('Invalid palette: slot 0 must be background or blank')
  }

  for (let i = 1; i < palette.length; i += 1) {
    if (palette[i]?.kind !== 'bead') {
      throw new Error('Invalid palette: reserved kinds are only allowed at slot 0')
    }
  }
}

export type GridData = number[]

export type ColorStat = {
  paletteIndex: number
  count: number
}

export type PatternResult = {
  width: number
  height: number
  cells: GridData
  palette: ReservedPalette
  colorStats: ColorStat[]
  previewBuffer: Buffer
}

export type ExportSheetInput = {
  width: number
  height: number
  cells: GridData
  palette: ReservedPalette
  colorStats: ColorStat[]
}
