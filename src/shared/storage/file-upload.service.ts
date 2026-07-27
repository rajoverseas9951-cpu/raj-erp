export interface FileUploadInput {
  tenantId?: string;
  ownerId?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  body: Buffer | Uint8Array | NodeJS.ReadableStream;
  visibility?: 'private' | 'public';
}

export interface UploadedFile {
  id: string;
  provider: string;
  bucket?: string;
  objectKey: string;
  url?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface FileUploadService {
  upload(input: FileUploadInput): Promise<UploadedFile>;
  remove(objectKey: string): Promise<void>;
  getSignedUrl(objectKey: string, expiresInSeconds?: number): Promise<string>;
}
