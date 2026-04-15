import type {
  BackgroundMode,
  ColorStat,
  DetailLevel,
  ExportSheetInput,
  GridData,
  PaletteItem,
  PatternResult,
  ReservedPalette,
} from '@perler/shared'

export type {
  BackgroundMode,
  ColorStat,
  DetailLevel,
  ExportSheetInput,
  GridData,
  PaletteItem,
  PatternResult,
  ReservedPalette,
}

export type GeneratePatternInput = {
  imageBuffer: Buffer
  gridWidth: number
  gridHeight: number
  colorCount: number
  detailLevel: DetailLevel
  backgroundMode: BackgroundMode
}
