import { renderExportSheet } from '@perler/pattern-core/src/export-sheet.ts'

import type { DbClient } from '../../lib/db.ts'
import type { StorageAdapter } from '../../lib/storage.ts'

type ExportSheetPayload = {
  width: number
  height: number
  cells: number[]
  palette: {
    kind: string
    hex: string
    code?: string
  }[]
  colorStats: {
    paletteIndex: number
    count: number
  }[]
}

function normalizeExportSheetPayload(input: {
  gridData: unknown
  paletteData: unknown
  colorStats: unknown
}): ExportSheetPayload {
  if (!input.gridData || typeof input.gridData !== 'object') {
    throw new Error('INVALID_VERSION_DATA')
  }
  const gridData = input.gridData as {
    width?: unknown
    height?: unknown
    cells?: unknown
  }
  if (
    typeof gridData.width !== 'number' ||
    !Number.isInteger(gridData.width) ||
    typeof gridData.height !== 'number' ||
    !Number.isInteger(gridData.height) ||
    !Array.isArray(gridData.cells)
  ) {
    throw new Error('INVALID_VERSION_DATA')
  }

  if (!Array.isArray(input.paletteData) || !Array.isArray(input.colorStats)) {
    throw new Error('INVALID_VERSION_DATA')
  }
  const palette = input.paletteData.map(item => {
    if (!item || typeof item !== 'object') {
      throw new Error('INVALID_VERSION_DATA')
    }
    const value = item as { kind?: unknown; hex?: unknown; code?: unknown }
    if (
      typeof value.kind !== 'string' ||
      typeof value.hex !== 'string' ||
      (value.code !== undefined && typeof value.code !== 'string')
    ) {
      throw new Error('INVALID_VERSION_DATA')
    }
    return { kind: value.kind, hex: value.hex, code: value.code }
  })

  const rawColorStats = input.colorStats.map(item => {
    if (!item || typeof item !== 'object') {
      throw new Error('INVALID_VERSION_DATA')
    }
    const value = item as { paletteIndex?: unknown; count?: unknown }
    if (
      typeof value.paletteIndex !== 'number' ||
      !Number.isInteger(value.paletteIndex) ||
      value.paletteIndex < 0 ||
      typeof value.count !== 'number' ||
      !Number.isInteger(value.count) ||
      value.count < 0
    ) {
      throw new Error('INVALID_VERSION_DATA')
    }
    return { paletteIndex: value.paletteIndex, count: value.count }
  })
  const shouldExcludeBlank = palette[0]?.kind === 'blank'
  const colorStats = shouldExcludeBlank
    ? rawColorStats.filter(item => item.paletteIndex !== 0)
    : rawColorStats

  return {
    width: gridData.width,
    height: gridData.height,
    cells: gridData.cells.map(cell => {
      if (typeof cell !== 'number' || !Number.isInteger(cell)) {
        throw new Error('INVALID_VERSION_DATA')
      }
      return cell
    }),
    palette,
    colorStats,
  }
}

export class ExportService {
  private readonly db: DbClient
  private readonly storage: StorageAdapter

  constructor(db: DbClient, storage: StorageAdapter) {
    this.db = db
    this.storage = storage
  }

  async exportVersionSheet(input: { versionId: string; userId: string }) {
    const version = await this.db.projectVersion.findFirst({
      where: {
        id: input.versionId,
        project: { userId: input.userId },
      },
      select: {
        id: true,
        projectId: true,
        gridData: true,
        paletteData: true,
        colorStats: true,
      },
    })
    if (!version) {
      return null
    }

    const exportPayload = normalizeExportSheetPayload({
      gridData: version.gridData,
      paletteData: version.paletteData,
      colorStats: version.colorStats,
    })
    const buffer = await renderExportSheet(exportPayload)
    const exportKey = `exports/${version.id}.png`
    const exportImageUrl = `/${exportKey}`

    await this.storage.putObject({
      key: exportKey,
      body: buffer,
      contentType: 'image/png',
    })

    const exportRecord = await this.db.exportRecord.create({
      data: {
        projectId: version.projectId,
        versionId: version.id,
        exportImageUrl,
      },
    })

    return {
      id: exportRecord.id,
      projectId: exportRecord.projectId,
      versionId: exportRecord.versionId,
      exportImageUrl: exportRecord.exportImageUrl,
      createdAt: exportRecord.createdAt,
      updatedAt: exportRecord.updatedAt,
    }
  }
}
