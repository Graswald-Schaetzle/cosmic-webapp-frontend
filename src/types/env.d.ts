/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MATTERPORT_MODEL_ID: string;
  readonly VITE_MATTERPORT_KEY: string;
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
