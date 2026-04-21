export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface PaginationQuery {
  page?: number
  limit?: number
}
