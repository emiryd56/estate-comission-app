const CURRENCY_FORMATTER = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'TRY',
  currencyDisplay: 'code',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Formats a TRY amount with the ISO currency code prefix.
 * Example: formatCurrency(1_250_000) => "TRY 1,250,000.00"
 */
export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) {
    return 'TRY 0.00'
  }
  return CURRENCY_FORMATTER.format(value)
}

/**
 * Variant without fractional digits, useful for compact dashboard figures.
 * Example: formatCurrencyCompact(1_250_000) => "TRY 1,250,000"
 */
export function formatCurrencyCompact(value: number): string {
  if (!Number.isFinite(value)) {
    return 'TRY 0'
  }
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'TRY',
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(value)
}
