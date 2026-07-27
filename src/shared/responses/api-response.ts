export interface ResponseMeta {
  requestId?: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message: string;
  meta: ResponseMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: ResponseMeta;
}

export const successResponse = <T>(data: T, message = 'Request completed successfully', meta: Partial<ResponseMeta> = {}): ApiSuccessResponse<T> => ({
  success: true,
  data,
  message,
  meta: { timestamp: new Date().toISOString(), ...meta },
});

export const errorResponse = (code: string, message: string, details?: unknown, meta: Partial<ResponseMeta> = {}): ApiErrorResponse => ({
  success: false,
  error: { code, message, details },
  meta: { timestamp: new Date().toISOString(), ...meta },
});
