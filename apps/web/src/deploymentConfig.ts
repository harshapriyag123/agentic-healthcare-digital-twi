export type PublicDeploymentConfig = { apiBaseUrl: string; appEnv: 'local' | 'test' | 'staging' | 'production'; appVersion: string; deploymentName: string; syntheticData: true };

export function buildDeploymentConfig(values: Record<string, string | undefined>): PublicDeploymentConfig {
    const appEnv = values.VITE_APP_ENV || 'local';
    if (!['local', 'test', 'staging', 'production'].includes(appEnv)) throw new Error(`Unsupported VITE_APP_ENV: ${appEnv}`);
    const rawApi = (values.VITE_API_BASE_URL || '').trim();
    let apiBaseUrl = '';
    if (rawApi) {
        let parsed: URL;
        try { parsed = new URL(rawApi); } catch { throw new Error('VITE_API_BASE_URL must be an absolute HTTP(S) URL.'); }
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('VITE_API_BASE_URL must be a public HTTP(S) origin without credentials, query, or fragment.');
        if (appEnv === 'production' && parsed.protocol !== 'https:') throw new Error('VITE_API_BASE_URL must use HTTPS in production.');
        if (appEnv === 'production' && ['localhost', '127.0.0.1'].includes(parsed.hostname)) throw new Error('Production API URL cannot use localhost.');
        apiBaseUrl = rawApi.replace(/\/+$/, '');
    }
    return { apiBaseUrl, appEnv: appEnv as PublicDeploymentConfig['appEnv'], appVersion: values.VITE_APP_VERSION || '0.1.0-dev', deploymentName: values.VITE_DEPLOYMENT_NAME || 'GeoTwin Sentinel', syntheticData: true };
}

const runtimeValues = {
    ...(import.meta.env as Record<string, string | undefined>),
    VITE_APP_ENV: import.meta.env.VITE_APP_ENV || (import.meta.env.PROD ? 'production' : 'local'),
};

function loadRuntimeConfig() {
    try {
        return { config: buildDeploymentConfig(runtimeValues), error: '' };
    } catch (error) {
        return {
            config: {
                apiBaseUrl: '',
                appEnv: (import.meta.env.PROD ? 'production' : 'local') as PublicDeploymentConfig['appEnv'],
                appVersion: import.meta.env.VITE_APP_VERSION || '0.1.0-dev',
                deploymentName: import.meta.env.VITE_DEPLOYMENT_NAME || 'GeoTwin Sentinel',
                syntheticData: true as const,
            },
            error: error instanceof Error ? error.message : 'Invalid public deployment configuration.',
        };
    }
}

const runtimeConfig = loadRuntimeConfig();
export const deploymentConfig = runtimeConfig.config;
export const deploymentConfigError = runtimeConfig.error;

export function apiUrl(path: string) {
    if (!path.startsWith('/')) throw new Error('API path must begin with /.');
    return `${deploymentConfig.apiBaseUrl}${path}`;
}
