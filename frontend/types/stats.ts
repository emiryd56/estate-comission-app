import type { TransactionStage, Transaction } from './transaction'

export interface StageBreakdown {
  total: number
  active: number
  completed: number
  byStage: Record<TransactionStage, number>
  completedFeeSum: number
}

export interface EarningsSummary {
  total: number
  thisMonth: number
  scope: 'company' | 'personal'
}

export interface TopAgentEntry {
  agentId: string
  name: string
  email: string
  completedCount: number
  totalCut: number
}

export interface TransactionStats {
  breakdown: StageBreakdown
  earnings: EarningsSummary
  recent: Transaction[]
  topAgents: TopAgentEntry[]
}
