import { TransactionStage } from '~/types'

export const STAGE_LABELS: Readonly<Record<TransactionStage, string>> = {
  [TransactionStage.AGREEMENT]: 'Anlaşma',
  [TransactionStage.EARNEST_MONEY]: 'Kaparo',
  [TransactionStage.TITLE_DEED]: 'Tapu',
  [TransactionStage.COMPLETED]: 'Tamamlandı',
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

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value)
}
