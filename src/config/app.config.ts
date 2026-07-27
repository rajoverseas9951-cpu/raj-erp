export interface AppConfig {
  env: string;
  name: string;
  apiPrefix: string;
  apiVersion: string;
}

export const appConfig: AppConfig = {
  env: process.env.NODE_ENV ?? 'development',
  name: process.env.APP_NAME ?? 'Raj ERP',
  apiPrefix: process.env.API_PREFIX ?? '/api',
  apiVersion: process.env.API_VERSION ?? 'v1',
};
