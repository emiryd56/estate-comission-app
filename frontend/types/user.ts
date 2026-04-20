export enum UserRole {
  ADMIN = 'admin',
  AGENT = 'agent',
}

export interface User {
  _id: string
  name: string
  email: string
  role: UserRole
  createdAt: string
  updatedAt: string
}

export type PopulatedAgent = Pick<User, '_id' | 'name' | 'email'>

export interface CreateUserPayload {
  name: string
  email: string
  password: string
  role?: UserRole
}
