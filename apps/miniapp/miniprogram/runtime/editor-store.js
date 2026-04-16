function clonePalette(input) {
  return input.map(item => Object.assign({}, item))
}

function cloneSnapshot(input) {
  return {
    width: input.width,
    height: input.height,
    cells: input.cells.slice(),
    palette: clonePalette(input.palette),
    selectedColor: input.selectedColor,
  }
}

function createInitialSnapshot(input) {
  return {
    width: input.width,
    height: input.height,
    cells: input.cells.slice(),
    palette: clonePalette(input.palette),
    selectedColor: input.palette[1] ? input.palette[1].index : (input.palette[0] ? input.palette[0].index : 0),
  }
}

function isValidCell(snapshot, cellIndex) {
  return cellIndex >= 0 && cellIndex < snapshot.cells.length
}

function hasPaletteIndex(snapshot, colorIndex) {
  return snapshot.palette.some(item => item.index === colorIndex)
}

function createEditorStore(initial) {
  let present = createInitialSnapshot(initial)
  const undoStack = []
  const redoStack = []

  function commit(mutator) {
    const before = cloneSnapshot(present)
    const draft = cloneSnapshot(present)
    mutator(draft)

    if (
      draft.selectedColor === before.selectedColor &&
      draft.cells.every((value, index) => value === before.cells[index])
    ) {
      return
    }

    undoStack.push(before)
    redoStack.length = 0
    present = draft
  }

  function colorAt(cellIndex) {
    return isValidCell(present, cellIndex) ? (present.cells[cellIndex] || 0) : 0
  }

  return {
    selectColor(colorIndex) {
      if (!hasPaletteIndex(present, colorIndex)) {
        return
      }
      commit(draft => {
        draft.selectedColor = colorIndex
      })
    },

    paintCell(cellIndex) {
      if (!isValidCell(present, cellIndex)) {
        return
      }
      commit(draft => {
        draft.cells[cellIndex] = draft.selectedColor
      })
    },

    eraseCell(cellIndex) {
      if (!isValidCell(present, cellIndex)) {
        return
      }
      commit(draft => {
        draft.cells[cellIndex] = draft.palette[0] ? draft.palette[0].index : 0
      })
    },

    pickColor(cellIndex) {
      if (!isValidCell(present, cellIndex)) {
        return
      }
      commit(draft => {
        draft.selectedColor = draft.cells[cellIndex] != null ? draft.cells[cellIndex] : draft.selectedColor
      })
    },

    fillArea(cellIndex) {
      if (!isValidCell(present, cellIndex)) {
        return
      }
      const targetColor = colorAt(cellIndex)
      if (targetColor === present.selectedColor) {
        return
      }

      commit(draft => {
        const queue = [cellIndex]
        const seen = new Set()

        while (queue.length > 0) {
          const current = queue.shift()
          if (seen.has(current)) {
            continue
          }
          seen.add(current)

          if (draft.cells[current] !== targetColor) {
            continue
          }

          draft.cells[current] = draft.selectedColor

          const row = Math.floor(current / draft.width)
          const col = current % draft.width
          const neighbors = [
            row > 0 ? current - draft.width : -1,
            row < draft.height - 1 ? current + draft.width : -1,
            col > 0 ? current - 1 : -1,
            col < draft.width - 1 ? current + 1 : -1,
          ]

          neighbors.forEach(neighbor => {
            if (neighbor >= 0) {
              queue.push(neighbor)
            }
          })
        }
      })
    },

    replaceColor(from, to) {
      if (from === to || !hasPaletteIndex(present, to)) {
        return
      }
      commit(draft => {
        draft.cells = draft.cells.map(cell => (cell === from ? to : cell))
      })
    },

    undo() {
      const previous = undoStack.pop()
      if (!previous) {
        return
      }
      redoStack.push(cloneSnapshot(present))
      present = previous
    },

    redo() {
      const next = redoStack.pop()
      if (!next) {
        return
      }
      undoStack.push(cloneSnapshot(present))
      present = next
    },

    snapshot() {
      return {
        width: present.width,
        height: present.height,
        cells: present.cells.slice(),
        palette: clonePalette(present.palette),
      }
    },

    selectedColor() {
      return present.selectedColor
    },
  }
}

module.exports = {
  createEditorStore,
}
