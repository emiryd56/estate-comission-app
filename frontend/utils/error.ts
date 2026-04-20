import type { FetchError } from 'ofetch'

interface ApiErrorBody {
  message?: string | string[]
  error?: string
  statusCode?: number
}

function isFetchError(value: unknown): value is FetchError<ApiErrorBody> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'response' in value &&
    'data' in value
  )
}

export function extractErrorMessage(err: unknown): string {
  if (isFetchError(err)) {
    const raw = err.data?.message ?? err.message
    if (Array.isArray(raw)) {
      return raw.join(', ')
    }
    return raw ?? 'Unexpected API error'
  }

  if (err instanceof Error) {
    return err.message
  }

  return 'Unexpected error'
}
