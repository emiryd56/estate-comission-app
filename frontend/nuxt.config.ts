// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss'],

  css: ['~/assets/css/tailwind.css'],

  runtimeConfig: {
    public: {
      // Override at runtime with NUXT_PUBLIC_API_BASE
      apiBase: 'http://localhost:3001',
    },
  },
})
