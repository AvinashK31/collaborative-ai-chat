/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_WEBSOCKET_URL: string
  readonly VITE_APP_NAME: string
  readonly VITE_APP_VERSION: string
  readonly VITE_DEBUG: string
  readonly VITE_ANALYTICS_ID?: string
  readonly VITE_SENTRY_DSN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 