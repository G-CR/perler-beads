import assert from 'node:assert/strict'
import test from 'node:test'

import { createEditorStore } from './store.ts'

test('editor store supports brush, replace-all and undo', () => {
  const store = createEditorStore({
    width: 2,
    height: 2,
    cells: [0, 1, 1, 0],
    palette: [
      { index: 0, name: 'background', hex: '#ffffff', kind: 'background' },
      { index: 1, name: 'blue', hex: '#0000ff', kind: 'bead' },
      { index: 2, name: 'red', hex: '#ff0000', kind: 'bead' },
    ],
  })

  store.selectColor(2)
  store.paintCell(0)
  store.replaceColor(1, 2)
  store.undo()

  assert.deepEqual(store.snapshot().cells, [2, 1, 1, 0])
})

test('editor store erases to palette slot zero and supports redo', () => {
  const store = createEditorStore({
    width: 2,
    height: 2,
    cells: [2, 2, 1, 0],
    palette: [
      { index: 0, name: 'background', hex: '#ffffff', kind: 'background' },
      { index: 1, name: 'blue', hex: '#0000ff', kind: 'bead' },
      { index: 2, name: 'red', hex: '#ff0000', kind: 'bead' },
    ],
  })

  store.eraseCell(1)
  store.undo()
  store.redo()

  assert.deepEqual(store.snapshot().cells, [2, 0, 1, 0])
})
