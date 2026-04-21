<script setup lang="ts">
import { computed } from 'vue'
import { TransactionStage } from '~/types'
import { STAGE_LABELS, STAGE_ORDER } from '~/utils/stage'

interface Props {
  byStage: Record<TransactionStage, number>
  total: number
}

const props = defineProps<Props>()

interface Segment {
  stage: TransactionStage
  label: string
  count: number
  percent: number
  colorClass: string
  dotClass: string
}

const STAGE_COLORS: Readonly<Record<TransactionStage, { bar: string; dot: string }>> = {
  [TransactionStage.AGREEMENT]: {
    bar: 'bg-slate-400',
    dot: 'bg-slate-400',
  },
  [TransactionStage.EARNEST_MONEY]: {
    bar: 'bg-amber-400',
    dot: 'bg-amber-400',
  },
  [TransactionStage.TITLE_DEED]: {
    bar: 'bg-sky-500',
    dot: 'bg-sky-500',
  },
  [TransactionStage.COMPLETED]: {
    bar: 'bg-emerald-500',
    dot: 'bg-emerald-500',
  },
}

const segments = computed<Segment[]>(() =>
  STAGE_ORDER.map((stage) => {
    const count = props.byStage[stage] ?? 0
    const percent = props.total === 0 ? 0 : (count / props.total) * 100
    return {
      stage,
      label: STAGE_LABELS[stage],
      count,
      percent,
      colorClass: STAGE_COLORS[stage].bar,
      dotClass: STAGE_COLORS[stage].dot,
    }
  }),
)
</script>

<template>
  <div>
    <div class="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        v-for="segment in segments"
        :key="segment.stage"
        class="h-full transition-all"
        :class="segment.colorClass"
        :style="{ width: `${segment.percent}%` }"
        :title="`${segment.label}: ${segment.count}`"
      />
    </div>
    <ul class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <li
        v-for="segment in segments"
        :key="segment.stage"
        class="flex items-start gap-2"
      >
        <span
          class="mt-1 inline-block h-2.5 w-2.5 rounded-full"
          :class="segment.dotClass"
        />
        <div class="min-w-0">
          <p class="truncate text-xs font-medium text-slate-600">
            {{ segment.label }}
          </p>
          <p class="text-sm font-semibold text-slate-900">
            {{ segment.count }}
            <span class="ml-1 text-xs font-normal text-slate-400">
              ({{ segment.percent.toFixed(0) }}%)
            </span>
          </p>
        </div>
      </li>
    </ul>
  </div>
</template>
