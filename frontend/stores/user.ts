import { defineStore } from 'pinia'
import type { CreateUserPayload, User } from '~/types'

interface UserStoreState {
  users: User[]
  loading: boolean
  error: string | null
}

export const useUserStore = defineStore('users', {
  state: (): UserStoreState => ({
    users: [],
    loading: false,
    error: null,
  }),

  getters: {
    agents: (state): User[] =>
      state.users.filter((user) => user.role === 'agent'),
  },

  actions: {
    async fetchUsers(): Promise<User[]> {
      this.loading = true
      this.error = null
      try {
        const api = useApi()
        const data = await api<User[]>('/users')
        this.users = data
        return data
      } catch (err) {
        this.error = extractErrorMessage(err)
        throw err
      } finally {
        this.loading = false
      }
    },

    async createUser(payload: CreateUserPayload): Promise<User> {
      this.loading = true
      this.error = null
      try {
        const api = useApi()
        const created = await api<User>('/users', {
          method: 'POST',
          body: payload,
        })
        this.users = [created, ...this.users]
        return created
      } catch (err) {
        this.error = extractErrorMessage(err)
        throw err
      } finally {
        this.loading = false
      }
    },
  },
})
