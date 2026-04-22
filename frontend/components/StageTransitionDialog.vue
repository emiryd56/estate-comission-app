<script setup lang="ts">
import { computed } from 'vue'
import { TransactionStage } from '~/types'
import type { Transaction } from '~/types'
import { formatCurrency } from '~/utils/currency'
import { STAGE_BADGE_CLASS, STAGE_LABELS } from '~/utils/stage'

interface Props {
  modelValue: boolean
  transaction: Transaction | null
  nextStage: TransactionStage | null
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
}>()

const isFinalTransition = computed(
  () => props.nextStage === TransactionStage.COMPLETED,
)

const title = computed(() =>
  isFinalTransition.value ? 'Complete transaction' : 'Advance stage',
)

const description = computed(() =>
  isFinalTransition.value
    ? 'Once moved to Completed, the financial breakdown is calculated and locked.'
    : 'This transaction will move to its next stage. Stage changes cannot be undone.',
)

const confirmLabel = computed(() =>
  isFinalTransition.value ? 'Complete' : 'Yes, advance',
)

const variant = computed<'primary' | 'success'>(() =>
  isFinalTransition.value ? 'success' : 'primary',
)

function close(): void {
  emit('update:modelValue', false)
}

function handleConfirm(): void {
  emit('confirm')
}
</script>

<template>
  <ConfirmModal
    :model-value="modelValue"
    :title="title"
    :description="description"
    :confirm-label="confirmLabel"
    cancel-label="Cancel"
    :variant="variant"
    :loading="loading"
    persistent
    @update:model-value="close"
    @confirm="handleConfirm"
  >
    <div v-if="transaction && nextStage" class="space-y-4">
      <div class="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
          Transaction
        </p>
        <p class="mt-1 truncate text-sm font-semibold text-slate-900">
          {{ transaction.title }}
        </p>
      </div>

      <div class="flex items-center justify-between gap-3">
        <div class="flex-1">
          <p class="text-xs uppercase tracking-wide text-slate-400">
            Current stage
          </p>
          <span
            class="mt-1 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="STAGE_BADGE_CLASS[transaction.stage]"
          >
            {{ STAGE_LABELS[transaction.stage] }}
          </span>
        </div>

        <svg
          class="h-5 w-5 shrink-0 text-slate-400"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>

        <div class="flex-1 text-right">
          <p class="text-xs uppercase tracking-wide text-slate-400">
            Next stage
          </p>
          <span
            class="mt-1 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="STAGE_BADGE_CLASS[nextStage]"
          >
            {{ STAGE_LABELS[nextStage] }}
          </span>
        </div>
      </div>

      <div
        v-if="isFinalTransition"
        class="flex gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"
      >
        <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          Commission split will be calculated instantly on
          <strong>{{ formatCurrency(transaction.totalFee) }}</strong>
          and cannot be changed afterwards.
        </span>
      </div>
    </div>
  </ConfirmModal>
</template>
