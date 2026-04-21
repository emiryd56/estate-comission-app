import { defineStore } from 'pinia'
import type {
  CreateTransactionPayload,
  PaginatedResult,
  Transaction,
  TransactionQuery,
  TransactionStage,
  UpdateTransactionStagePayload,
} from '~/types'

const DEFAULT_LIMIT = 10

interface TransactionStoreState {
  transactions: Transaction[]
  total: number
  page: number
  limit: number
  totalPages: number
  search: string
  stage: TransactionStage | null
  loading: boolean
  error: string | null
}

interface FetchOptions extends TransactionQuery {
  resetPage?: boolean
}

export const useTransactionStore = defineStore('transactions', {
  state: (): TransactionStoreState => ({
    transactions: [],
    total: 0,
    page: 1,
    limit: DEFAULT_LIMIT,
    totalPages: 0,
    search: '',
    stage: null,
    loading: false,
    error: null,
  }),

  actions: {
    async fetchTransactions(
      options: FetchOptions = {},
    ): Promise<PaginatedResult<Transaction>> {
      this.loading = true
      this.error = null
      try {
        const api = useApi()

        if (options.search !== undefined) {
          this.search = options.search
        }
        if (options.stage !== undefined) {
          this.stage = options.stage ?? null
        }
        const limit = options.limit ?? this.limit
        const page = options.resetPage ? 1 : options.page ?? this.page

        const query: Record<string, string | number> = { page, limit }
        if (this.search.trim().length > 0) {
          query.search = this.search.trim()
        }
        if (this.stage) {
          query.stage = this.stage
        }

        const response = await api<PaginatedResult<Transaction>>(
          '/transactions',
          { query },
        )
        this.transactions = response.data
        this.total = response.total
        this.page = response.page
        this.limit = limit
        this.totalPages = response.totalPages
        return response
      } catch (err) {
        this.error = extractErrorMessage(err)
        throw err
      } finally {
        this.loading = false
      }
    },

    async fetchOne(id: string): Promise<Transaction> {
      const api = useApi()
      return api<Transaction>(`/transactions/${id}`)
    },

    async createTransaction(
      payload: CreateTransactionPayload,
    ): Promise<Transaction> {
      this.loading = true
      this.error = null
      try {
        const api = useApi()
        const created = await api<Transaction>('/transactions', {
          method: 'POST',
          body: payload,
        })
        await this.fetchTransactions({ resetPage: true })
        return created
      } catch (err) {
        this.error = extractErrorMessage(err)
        throw err
      } finally {
        this.loading = false
      }
    },

    async updateTransactionStage(
      id: string,
      stage: TransactionStage,
    ): Promise<Transaction> {
      this.loading = true
      this.error = null
      try {
        const api = useApi()
        const payload: UpdateTransactionStagePayload = { stage }
        const updated = await api<Transaction>(`/transactions/${id}/stage`, {
          method: 'PATCH',
          body: payload,
        })
        this.transactions = this.transactions.map((t) =>
          t._id === id ? updated : t,
        )
        return updated
      } catch (err) {
        this.error = extractErrorMessage(err)
        throw err
      } finally {
        this.loading = false
      }
    },

    setPage(page: number): Promise<PaginatedResult<Transaction>> {
      return this.fetchTransactions({ page })
    },

    resetFilters(): Promise<PaginatedResult<Transaction>> {
      this.search = ''
      this.stage = null
      return this.fetchTransactions({ resetPage: true })
    },
  },
})
