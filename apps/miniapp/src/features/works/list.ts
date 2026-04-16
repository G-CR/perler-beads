export type ProjectListItem = {
  id: string
  title?: string
  isFavorite: boolean
  updatedAt: string
  currentVersionId?: string | null
}

export type ProjectTabs = {
  all: ProjectListItem[]
  favorite: ProjectListItem[]
  recent: ProjectListItem[]
}

function byUpdatedAtDesc(left: ProjectListItem, right: ProjectListItem): number {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
}

export function splitProjectsByFilter(input: ProjectListItem[]): ProjectTabs {
  const all = [...input].sort(byUpdatedAtDesc)
  return {
    all,
    favorite: all.filter(item => item.isFavorite),
    recent: [...all],
  }
}
