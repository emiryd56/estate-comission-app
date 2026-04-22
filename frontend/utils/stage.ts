import { TransactionStage } from '~/types'

export const STAGE_LABELS: Readonly<Record<TransactionStage, string>> = {
  [TransactionStage.AGREEMENT]: 'Agreement',
  [TransactionStage.EARNEST_MONEY]: 'Earnest money',
  [TransactionStage.TITLE_DEED]: 'Title deed',
  [TransactionStage.COMPLETED]: 'Completed',
}

export const STAGE_ORDER: readonly TransactionStage[] = [
  TransactionStage.AGREEMENT,
  TransactionStage.EARNEST_MONEY,
  TransactionStage.TITLE_DEED,
  TransactionStage.COMPLETED,
]

export const STAGE_BADGE_CLASS: Readonly<Record<TransactionStage, string>> = {
  [TransactionStage.AGREEMENT]: 'bg-slate-100 text-slate-700 ring-slate-200',
  [TransactionStage.EARNEST_MONEY]: 'bg-amber-50 text-amber-800 ring-amber-200',
  [TransactionStage.TITLE_DEED]: 'bg-sky-50 text-sky-800 ring-sky-200',
  [TransactionStage.COMPLETED]: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
}

export function getNextStage(
  current: TransactionStage,
): TransactionStage | null {
  const index = STAGE_ORDER.indexOf(current)
  if (index === -1 || index >= STAGE_ORDER.length - 1) {
    return null
  }
  return STAGE_ORDER[index + 1]
}
