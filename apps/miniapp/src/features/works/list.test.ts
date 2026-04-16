import assert from 'node:assert/strict'
import test from 'node:test'

import { splitProjectsByFilter } from './list.ts'

test('splitProjectsByFilter keeps favorites and recents as independent tabs', () => {
  const result = splitProjectsByFilter([
    { id: '1', isFavorite: true, updatedAt: '2026-04-15T10:00:00Z' },
    { id: '2', isFavorite: false, updatedAt: '2026-04-15T09:00:00Z' },
  ])

  assert.deepEqual(result.favorite.map(item => item.id), ['1'])
  assert.deepEqual(result.recent.map(item => item.id), ['1', '2'])
})
