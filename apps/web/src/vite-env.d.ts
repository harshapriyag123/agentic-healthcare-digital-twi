/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_BASE_URL?: string;
    readonly VITE_APP_ENV?: 'local' | 'test' | 'staging' | 'production';
    readonly VITE_APP_VERSION?: string;
    readonly VITE_DEPLOYMENT_NAME?: string;
    readonly VITE_MAP_STYLE_URL?: string;
    readonly VITE_SIGNOZ_DASHBOARD_URL?: string;
}
