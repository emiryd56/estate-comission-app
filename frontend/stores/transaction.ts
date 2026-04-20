import { defineStore } from 'pinia'
import type {
  CreateTransactionPayload,
  Transaction,
  TransactionStage,
  UpdateTransactionStagePayload,
} from '~/types'

interface TransactionStoreState {
  transactions: Transaction[]
  loading: boolean
  error: string | null
}

export const useTransactionStore = defineStore('transactions', {
  state: (): TransactionStoreState => ({
    transactions: [],
    loading: false,
    error: null,
  }),

  getters: {
    getById:
      (state) =>
      (id: string): Transaction | undefined =>
        state.transactions.find((t) => t._id === id),

    byStage:
      (state) =>
      (stage: TransactionStage): Transaction[] =>
        state.transactions.filter((t) => t.stage === stage),

    completedCount: (state): number =>
      state.transactions.filter((t) => t.stage === 'completed').length,
  },

  actions: {
    async fetchTransactions(): Promise<Transaction[]> {
      this.loading = true
      this.error = null
      try {
        const api = useApi()
        const data = await api<Transaction[]>('/transactions')
        this.transactions = data
        return data
      } catch (err) {
        this.error = extractErrorMessage(err)
        throw err
      } finally {
        this.loading = false
      }
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
        this.transactions = [created, ...this.transactions]
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
  },
})
