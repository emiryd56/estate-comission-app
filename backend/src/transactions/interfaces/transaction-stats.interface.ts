import type { TransactionStage } from '../enums/transaction-stage.enum';
import type { TransactionDocument } from '../schemas/transaction.schema';

export interface StageBreakdown {
  total: number;
  active: number;
  completed: number;
  byStage: Record<TransactionStage, number>;
  completedFeeSum: number;
}

export interface EarningsSummary {
  total: number;
  thisMonth: number;
  /**
   * Semantic label describing what `total` represents for the caller:
   *  - 'company' for admins (sum of `financialBreakdown.companyCut`)
   *  - 'personal' for agents (sum of their own listing/selling cuts)
   */
  scope: 'company' | 'personal';
}

export interface TopAgentEntry {
  agentId: string;
  name: string;
  email: string;
  completedCount: number;
  totalCut: number;
}

export interface TransactionStats {
  breakdown: StageBreakdown;
  earnings: EarningsSummary;
  recent: TransactionDocument[];
  /** Recent transactions that are still in an active (non-completed) stage. */
  activeRecent: TransactionDocument[];
  topAgents: TopAgentEntry[];
}
