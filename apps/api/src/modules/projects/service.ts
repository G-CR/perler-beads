import type { DbClient } from '../../lib/db.ts'

type SaveEditedVersionInput = {
  userId: string
  baseVersionId: string
  gridData: unknown
  paletteData: unknown
  colorStats: unknown
}

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

export class ProjectsService {
  private readonly db: DbClient

  constructor(db: DbClient) {
    this.db = db
  }

  async createProject(input: {
    userId: string
    title: string
    sourceImageUrl: string
  }) {
    return this.db.project.create({
      data: {
        userId: input.userId,
        title: input.title,
        sourceImageUrl: input.sourceImageUrl,
      },
    })
  }

  async listProjects(userId: string) {
    return this.db.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async toggleFavorite(input: { userId: string; projectId: string }) {
    const project = await this.db.project.findFirst({
      where: { id: input.projectId, userId: input.userId },
      select: { id: true, isFavorite: true },
    })
    if (!project) {
      return null
    }

    return this.db.project.update({
      where: { id: project.id },
      data: { isFavorite: !project.isFavorite },
    })
  }

  async listProjectVersions(input: { userId: string; projectId: string }) {
    const project = await this.db.project.findFirst({
      where: { id: input.projectId, userId: input.userId },
      select: { id: true },
    })
    if (!project) {
      return null
    }

    return this.db.projectVersion.findMany({
      where: { projectId: project.id },
      orderBy: { versionNo: 'desc' },
    })
  }

  async getVersion(input: { userId: string; versionId: string }) {
    return this.db.projectVersion.findFirst({
      where: {
        id: input.versionId,
        project: { userId: input.userId },
      },
    })
  }

  async saveEditedVersion(input: SaveEditedVersionInput) {
    const baseVersion = await this.db.projectVersion.findFirst({
      where: {
        id: input.baseVersionId,
        project: { userId: input.userId },
      },
      select: {
        projectId: true,
        paramsSnapshot: true,
        previewImageUrl: true,
      },
    })
    if (!baseVersion) {
      return null
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.db.$transaction(async tx => {
          const latestVersion = await tx.projectVersion.findFirst({
            where: { projectId: baseVersion.projectId },
            orderBy: { versionNo: 'desc' },
            select: { versionNo: true },
          })
          const versionNo = (latestVersion?.versionNo ?? 0) + 1

          const version = await tx.projectVersion.create({
            data: {
              projectId: baseVersion.projectId,
              versionNo,
              sourceType: 'edited',
              paramsSnapshot: baseVersion.paramsSnapshot,
              gridData: input.gridData,
              paletteData: input.paletteData,
              colorStats: input.colorStats,
              previewImageUrl: baseVersion.previewImageUrl,
            },
          })

          await tx.project.update({
            where: { id: baseVersion.projectId },
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
