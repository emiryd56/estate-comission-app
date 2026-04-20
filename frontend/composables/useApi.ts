type ApiClient = ReturnType<typeof $fetch.create>

let cachedFetch: ApiClient | undefined

export function useApi(): ApiClient {
  if (cachedFetch) {
    return cachedFetch
  }

  const config = useRuntimeConfig()

  cachedFetch = $fetch.create({
    baseURL: config.public.apiBase,
    headers: {
      Accept: 'application/json',
    },
    onResponseError({ response }) {
      const message =
        (response._data as { message?: string | string[] } | undefined)
          ?.message ?? response.statusText
      console.error(`[API ${response.status}]`, message)
    },
  })

  return cachedFetch
}
