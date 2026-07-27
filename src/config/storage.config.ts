export interface StorageConfig {
  provider: 'local' | 's3' | 'gcs' | 'azure';
  bucket?: string;
  publicBaseUrl?: string;
}

export const storageConfig: StorageConfig = {
  provider: (process.env.STORAGE_PROVIDER as StorageConfig['provider']) ?? 'local',
  bucket: process.env.STORAGE_BUCKET,
  publicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL,
};
