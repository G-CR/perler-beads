import assert from 'node:assert/strict'
import test from 'node:test'

import { buildGeneratePayload, defaultCreateForm } from './form.ts'

test('defaultCreateForm starts with shared defaults', () => {
  assert.deepEqual(defaultCreateForm(), {
    gridWidth: 64,
    gridHeight: 64,
    colorCount: 16,
    detailLevel: 'medium',
    backgroundMode: 'keep',
  })
})

test('buildGeneratePayload maps form state to API payload', () => {
  const payload = buildGeneratePayload({
    ...defaultCreateForm(),
    gridWidth: 48,
    gridHeight: 64,
    colorCount: 12,
    detailLevel: 'high',
    backgroundMode: 'remove',
  })

  assert.deepEqual(payload, {
    gridWidth: 48,
    gridHeight: 64,
    colorCount: 12,
    detailLevel: 'high',
    backgroundMode: 'remove',
  })
})
