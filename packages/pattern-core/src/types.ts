import type {
  BackgroundMode,
  ColorStat,
  DetailLevel,
  ExportSheetInput,
  GridData,
  PaletteItem,
  PatternResult,
} from '../../shared/src/index.ts'

export type {
  BackgroundMode,
  ColorStat,
  DetailLevel,
  ExportSheetInput,
  GridData,
  PaletteItem,
  PatternResult,
}

export type GeneratePatternInput = {
  imageBuffer: Buffer
  gridWidth: number
  gridHeight: number
  colorCount: number
  detailLevel: DetailLevel
  backgroundMode: BackgroundMode
}
