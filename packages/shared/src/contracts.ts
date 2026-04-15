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

export type PaletteItem = {
  kind: 'background' | 'bead'
  hex: string
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
  palette: PaletteItem[]
  colorStats: ColorStat[]
  previewPng: Buffer
}

export type ExportSheetInput = {
  width: number
  height: number
  cells: GridData
  palette: PaletteItem[]
  colorStats: ColorStat[]
}
