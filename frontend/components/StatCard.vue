<script setup lang="ts">
interface Props {
  label: string
  value: string
  sublabel?: string
  /** Tailwind utility class list for the icon wrapper, e.g. 'bg-indigo-50 text-indigo-600'. */
  accent?: string
  /** Heroicons-style single-path SVG d attribute. */
  icon?: string
}

withDefaults(defineProps<Props>(), {
  sublabel: '',
  accent: 'bg-indigo-50 text-indigo-600',
  icon: '',
})
</script>

<template>
  <article
    class="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
          {{ label }}
        </p>
        <p class="mt-2 truncate text-2xl font-bold text-slate-900">
          {{ value }}
        </p>
        <p v-if="sublabel" class="mt-1 truncate text-xs text-slate-500">
          {{ sublabel }}
        </p>
      </div>
      <div
        v-if="icon"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
        :class="accent"
      >
        <svg
          class="h-5 w-5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" :d="icon" />
        </svg>
      </div>
    </div>
  </article>
</template>
