export type EditorPaletteItem = {
  index: number
  name: string
  code?: string
  hex: string
  kind: 'background' | 'blank' | 'bead'
}

export type EditorSnapshot = {
  width: number
  height: number
  cells: number[]
  palette: EditorPaletteItem[]
}

type MutableSnapshot = EditorSnapshot & {
  selectedColor: number
}

function clonePalette(input: EditorPaletteItem[]): EditorPaletteItem[] {
  return input.map(item => ({ ...item }))
}

function cloneSnapshot(input: MutableSnapshot): MutableSnapshot {
  return {
    width: input.width,
    height: input.height,
    cells: [...input.cells],
    palette: clonePalette(input.palette),
    selectedColor: input.selectedColor,
  }
}

function createInitialSnapshot(input: EditorSnapshot): MutableSnapshot {
  return {
    width: input.width,
    height: input.height,
    cells: [...input.cells],
    palette: clonePalette(input.palette),
    selectedColor: input.palette[1]?.index ?? input.palette[0]?.index ?? 0,
  }
}

function isValidCell(snapshot: MutableSnapshot, cellIndex: number): boolean {
  return cellIndex >= 0 && cellIndex < snapshot.cells.length
}

function hasPaletteIndex(snapshot: MutableSnapshot, colorIndex: number): boolean {
  return snapshot.palette.some(item => item.index === colorIndex)
}

export function createEditorStore(initial: EditorSnapshot) {
  let present = createInitialSnapshot(initial)
  const undoStack: MutableSnapshot[] = []
  const redoStack: MutableSnapshot[] = []

  function commit(mutator: (draft: MutableSnapshot) => void): void {
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

  function colorAt(cellIndex: number): number {
    return isValidCell(present, cellIndex) ? present.cells[cellIndex] ?? 0 : 0
  }

  return {
    selectColor(colorIndex: number): void {
      if (!hasPaletteIndex(present, colorIndex)) {
        return
      }
      commit(draft => {
        draft.selectedColor = colorIndex
      })
    },

    paintCell(cellIndex: number): void {
      if (!isValidCell(present, cellIndex)) {
        return
      }
      commit(draft => {
        draft.cells[cellIndex] = draft.selectedColor
      })
    },

    eraseCell(cellIndex: number): void {
      if (!isValidCell(present, cellIndex)) {
        return
      }
      commit(draft => {
        draft.cells[cellIndex] = draft.palette[0]?.index ?? 0
      })
    },

    pickColor(cellIndex: number): void {
      if (!isValidCell(present, cellIndex)) {
        return
      }
      commit(draft => {
        draft.selectedColor = draft.cells[cellIndex] ?? draft.selectedColor
      })
    },

    fillArea(cellIndex: number): void {
      if (!isValidCell(present, cellIndex)) {
        return
      }
      const targetColor = colorAt(cellIndex)
      if (targetColor === present.selectedColor) {
        return
      }

      commit(draft => {
        const queue = [cellIndex]
        const seen = new Set<number>()

        while (queue.length > 0) {
          const current = queue.shift()!
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

          for (const neighbor of neighbors) {
            if (neighbor >= 0) {
              queue.push(neighbor)
            }
          }
        }
      })
    },

    replaceColor(from: number, to: number): void {
      if (from === to || !hasPaletteIndex(present, to)) {
        return
      }
      commit(draft => {
        draft.cells = draft.cells.map(cell => (cell === from ? to : cell))
      })
    },

    undo(): void {
      const previous = undoStack.pop()
      if (!previous) {
        return
      }
      redoStack.push(cloneSnapshot(present))
      present = previous
    },

    redo(): void {
      const next = redoStack.pop()
      if (!next) {
        return
      }
      undoStack.push(cloneSnapshot(present))
      present = next
    },

    snapshot(): EditorSnapshot {
      return {
        width: present.width,
        height: present.height,
        cells: [...present.cells],
        palette: clonePalette(present.palette),
      }
    },

    selectedColor(): number {
      return present.selectedColor
    },
  }
}
