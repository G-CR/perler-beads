function byUpdatedAtDesc(left, right) {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
}

function splitProjectsByFilter(input) {
  const all = input.slice().sort(byUpdatedAtDesc)
  return {
    all,
    favorite: all.filter(item => item.isFavorite),
    recent: all.slice(),
  }
}

module.exports = {
  splitProjectsByFilter,
}
