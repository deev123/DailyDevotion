/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_YOUVERSION_APP_KEY: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
