<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

interface NavLink {
  to: string
  label: string
  icon: string
  adminOnly?: boolean
  exact?: boolean
}

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const allLinks: NavLink[] = [
  {
    to: '/',
    label: 'Dashboard',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    exact: true,
  },
  {
    to: '/transactions',
    label: 'Transactions',
    icon: 'M9 17v-2a4 4 0 014-4h4m-7-4h.01M9 5H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2h-4',
  },
  { to: '/transactions/new', label: 'New Transaction', icon: 'M12 4v16m8-8H4' },
  {
    to: '/users',
    label: 'Agents',
    icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 0a4 4 0 11-8 0 4 4 0 018 0z',
    adminOnly: true,
  },
]

const navLinks = computed(() =>
  allLinks.filter((link) => !link.adminOnly || authStore.isAdmin),
)

const currentUser = computed(() => authStore.user)

/** Sidebar open state — desktop (lg+) always visible; mobile/tablet toggles. */
const sidebarOpen = ref(false)

function toggleSidebar(): void {
  sidebarOpen.value = !sidebarOpen.value
}

function closeSidebar(): void {
  sidebarOpen.value = false
}

// Auto-close sidebar on route change (mobile)
watch(
  () => route.fullPath,
  () => {
    closeSidebar()
  },
)

onMounted(async () => {
  if (!authStore.user) {
    await authStore.hydrate()
  }
})

async function handleLogout(): Promise<void> {
  authStore.logout()
  await router.push('/login')
}
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <!-- Mobile overlay -->
    <Transition
      enter-active-class="transition-opacity duration-300 ease-in-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200 ease-in-out"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden"
        @click="closeSidebar"
      />
    </Transition>

    <!-- Sidebar -->
    <aside
      class="fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col bg-slate-900 text-white transition-transform duration-300 ease-in-out lg:static lg:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <!-- Sidebar header -->
      <div class="flex items-center justify-between border-b border-slate-800 px-6 py-5">
        <div>
          <h1 class="text-lg font-semibold tracking-tight">Estate Commission</h1>
          <p class="mt-1 text-xs text-slate-400">Transaction console</p>
        </div>
        <!-- Close button (mobile only) -->
        <button
          type="button"
          class="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white lg:hidden"
          aria-label="Close menu"
          @click="closeSidebar"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <NuxtLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          :active-class="link.exact ? '' : 'bg-slate-800 text-white'"
          :exact-active-class="link.exact ? 'bg-slate-800 text-white' : ''"
        >
          <svg
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              :d="link.icon"
            />
          </svg>
          {{ link.label }}
        </NuxtLink>
      </nav>

      <!-- User section -->
      <div v-if="currentUser" class="border-t border-slate-800 px-4 py-4">
        <div class="mb-3 flex items-center gap-3">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500 text-sm font-semibold"
          >
            {{ currentUser.email.charAt(0).toUpperCase() }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-white">
              {{ currentUser.email }}
            </p>
            <p class="text-xs capitalize text-slate-400">
              {{ currentUser.role === 'admin' ? 'Admin' : 'Agent' }}
            </p>
          </div>
        </div>
        <button
          type="button"
          class="flex w-full items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700"
          @click="handleLogout"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>

    <!-- Main content area -->
    <div class="flex min-w-0 flex-1 flex-col">
      <!-- Top bar with hamburger (visible only on mobile/tablet, hidden on lg+) -->
      <header class="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-sm lg:hidden">
        <button
          type="button"
          class="rounded-md p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          aria-label="Open menu"
          @click="toggleSidebar"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span class="text-sm font-semibold text-slate-900">Estate Commission</span>
        <div class="flex-1" />
        <div
          v-if="currentUser"
          class="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-xs font-semibold text-white"
        >
          {{ currentUser.email.charAt(0).toUpperCase() }}
        </div>
      </header>

      <!-- Page content — same p-8 as original -->
      <main class="flex-1 overflow-y-auto bg-slate-50 p-8">
        <slot />
      </main>
    </div>
  </div>
</template>
