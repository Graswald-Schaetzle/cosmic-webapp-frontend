/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;
  readonly VITE_MATTERPORT_MODEL_ID: string;
  readonly VITE_MATTERPORT_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
