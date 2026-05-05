/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_CHECKOUT_URL?: string;
  readonly VITE_CHECKOUT_STATUS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
