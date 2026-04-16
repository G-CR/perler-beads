import {
  defaultGenerateParams,
  generateParamsSchema,
  type GenerateParams,
} from '@perler/shared'

export type CreateFormState = GenerateParams

export function defaultCreateForm(): CreateFormState {
  return defaultGenerateParams()
}

export function buildGeneratePayload(input: CreateFormState): GenerateParams {
  return generateParamsSchema.parse({
    gridWidth: input.gridWidth,
    gridHeight: input.gridHeight,
    colorCount: input.colorCount,
    detailLevel: input.detailLevel,
    backgroundMode: input.backgroundMode,
  })
}

export function mergeCreateForm(
  current: CreateFormState,
  patch: Partial<CreateFormState>,
): CreateFormState {
  return {
    ...current,
    ...patch,
  }
}
