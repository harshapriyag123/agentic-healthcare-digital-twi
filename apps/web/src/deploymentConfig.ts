export type PublicDeploymentConfig = { apiBaseUrl: string; appEnv: 'local' | 'test' | 'staging' | 'production'; appVersion: string; deploymentName: string; syntheticData: true };

export function buildDeploymentConfig(values: Record<string, string | undefined>): PublicDeploymentConfig {
    const appEnv = values.VITE_APP_ENV || 'local';
    if (!['local', 'test', 'staging', 'production'].includes(appEnv)) throw new Error(`Unsupported VITE_APP_ENV: ${appEnv}`);
    const rawApi = (values.VITE_API_BASE_URL || '').trim();
    if (!rawApi && ['staging', 'production'].includes(appEnv)) throw new Error('VITE_API_BASE_URL is required for staging and production builds.');
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

export const deploymentConfig = buildDeploymentConfig(import.meta.env as Record<string, string | undefined>);

export function apiUrl(path: string) {
    if (!path.startsWith('/')) throw new Error('API path must begin with /.');
    return `${deploymentConfig.apiBaseUrl}${path}`;
}
