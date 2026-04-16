import { randomUUID } from 'node:crypto'

import { generatePattern } from '@perler/pattern-core/src/generate-pattern.ts'
import type { GenerateParams } from '@perler/shared'

import type { DbClient } from '../../lib/db.ts'
import type { StorageAdapter } from '../../lib/storage.ts'
import { buildAssetObjectUrl, parseAssetObjectUrl } from '../assets/routes.ts'

function isVersionNoUniqueConflict(error: unknown): boolean {
  if (
    !error ||
    typeof error !== 'object' ||
    !('code' in error) ||
    (error as { code?: unknown }).code !== 'P2002'
  ) {
    return false
  }
  const target = (error as { meta?: { target?: unknown } }).meta?.target
  if (Array.isArray(target)) {
    return target.includes('projectId') && target.includes('versionNo')
  }
  return (
    typeof target === 'string' &&
    target.includes('projectId') &&
    target.includes('versionNo')
  )
}

export class GenerationService {
  private readonly db: DbClient
  private readonly storage: StorageAdapter

  constructor(db: DbClient, storage: StorageAdapter) {
    this.db = db
    this.storage = storage
  }

  async generateVersion(input: {
    projectId: string
    params: GenerateParams
    userId: string
  }) {
    const project = await this.db.project.findFirst({
      where: { id: input.projectId, userId: input.userId },
      select: { id: true, sourceImageUrl: true },
    })
    if (!project) {
      throw new Error('PROJECT_NOT_FOUND')
    }

    const sourceImageKey = parseAssetObjectUrl(project.sourceImageUrl)
    if (!sourceImageKey) {
      throw new Error('INVALID_PROJECT_SOURCE_URL')
    }

    let imageBuffer: Buffer
    try {
      imageBuffer = await this.storage.getObject({ key: sourceImageKey })
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: unknown }).code === 'ENOENT'
      ) {
        throw new Error('SOURCE_IMAGE_NOT_FOUND')
      }
      throw error
    }

    const pattern = await generatePattern({
      imageBuffer,
      ...input.params,
    })
    const versionId = `ver_${randomUUID().replaceAll('-', '')}`
    const previewKey = `projects/${project.id}/versions/${versionId}/preview.bin`

    await this.storage.putObject({
      key: previewKey,
      body: pattern.previewBuffer,
      contentType: 'application/octet-stream',
    })
    const previewImageUrl = buildAssetObjectUrl(previewKey)

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.db.$transaction(async tx => {
          const latestVersion = await tx.projectVersion.findFirst({
            where: { projectId: project.id },
            orderBy: { versionNo: 'desc' },
            select: { versionNo: true },
          })
          const versionNo = (latestVersion?.versionNo ?? 0) + 1

          const version = await tx.projectVersion.create({
            data: {
              id: versionId,
              projectId: project.id,
              versionNo,
              sourceType: 'generated',
              paramsSnapshot: input.params,
              gridData: {
                width: pattern.width,
                height: pattern.height,
                cells: pattern.cells,
              },
              paletteData: pattern.palette,
              colorStats: pattern.colorStats,
              previewImageUrl,
            },
          })

          await tx.project.update({
            where: { id: project.id },
            data: { currentVersionId: version.id },
          })

          return version
        })
      } catch (error) {
        if (isVersionNoUniqueConflict(error) && attempt < 2) {
          continue
        }
        throw error
      }
    }

    throw new Error('VERSION_NUMBER_ALLOCATION_FAILED')
  }
}
