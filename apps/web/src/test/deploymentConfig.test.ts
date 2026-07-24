import { buildDeploymentConfig } from '../deploymentConfig';

describe('public deployment configuration', () => {
    it('normalizes a configured production API URL', () => {
        expect(buildDeploymentConfig({ VITE_APP_ENV: 'production', VITE_API_BASE_URL: 'https://api.example.com///', VITE_APP_VERSION: 'v1' })).toMatchObject({ apiBaseUrl: 'https://api.example.com', appEnv: 'production', appVersion: 'v1', syntheticData: true });
    });

    it('uses same-origin API routing when a production API URL is omitted', () => {
        expect(buildDeploymentConfig({ VITE_APP_ENV: 'production' }).apiBaseUrl).toBe('');
    });

    it('rejects localhost, credentialed, and insecure production URLs', () => {
        expect(() => buildDeploymentConfig({ VITE_APP_ENV: 'production', VITE_API_BASE_URL: 'http://localhost:8000' })).toThrow(/HTTPS|localhost/);
        const credentialedUrl = ['https://', 'user:secret@', 'api.example.com'].join('');
        expect(() => buildDeploymentConfig({ VITE_APP_ENV: 'production', VITE_API_BASE_URL: credentialedUrl })).toThrow(/credentials/);
    });

    it('allows relative proxy requests only in local and test modes', () => {
        expect(buildDeploymentConfig({ VITE_APP_ENV: 'local' }).apiBaseUrl).toBe('');
        expect(buildDeploymentConfig({ VITE_APP_ENV: 'test' }).apiBaseUrl).toBe('');
        expect(() => buildDeploymentConfig({ VITE_APP_ENV: 'unexpected' })).toThrow(/Unsupported/);
    });
});
