<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'

interface Props {
  modelValue: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Controls the confirm button theme. */
  variant?: 'primary' | 'danger' | 'success'
  loading?: boolean
  /** When true, clicking the backdrop does not close the modal. */
  persistent?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  description: '',
  confirmLabel: 'Onayla',
  cancelLabel: 'İptal',
  variant: 'primary',
  loading: false,
  persistent: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()

const confirmButtonClass: Record<NonNullable<Props['variant']>, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500',
}

function close(): void {
  if (props.loading) return
  emit('update:modelValue', false)
  emit('cancel')
}

function confirm(): void {
  if (props.loading) return
  emit('confirm')
}

function onBackdropClick(): void {
  if (props.persistent) return
  close()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.modelValue) {
    close()
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) {
      document.addEventListener('keydown', onKeydown)
    } else {
      document.removeEventListener('keydown', onKeydown)
    }
  },
)

onBeforeUnmount(() => {
  if (typeof document === 'undefined') return
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="onBackdropClick"
      >
        <Transition
          enter-active-class="duration-150 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="duration-100 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
          appear
        >
          <div
            v-if="modelValue"
            class="relative w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-slate-200"
          >
            <button
              v-if="!persistent"
              type="button"
              class="absolute right-3 top-3 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              :disabled="loading"
              aria-label="Kapat"
              @click="close"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div class="px-6 pb-2 pt-6">
              <h2 class="pr-8 text-lg font-semibold text-slate-900">
                {{ title }}
              </h2>
              <p v-if="description" class="mt-1 text-sm text-slate-500">
                {{ description }}
              </p>
            </div>

            <div class="px-6 pb-5 pt-3">
              <slot />
            </div>

            <footer class="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-3">
              <button
                type="button"
                class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="loading"
                @click="close"
              >
                {{ cancelLabel }}
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                :class="confirmButtonClass[variant]"
                :disabled="loading"
                @click="confirm"
              >
                <svg
                  v-if="loading"
                  class="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                {{ confirmLabel }}
              </button>
            </footer>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
