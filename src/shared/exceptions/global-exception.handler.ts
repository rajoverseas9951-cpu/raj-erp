import { errorResponse } from '../responses/api-response';
import { ApplicationException } from './application.exception';

export const handleException = (error: unknown, requestId?: string) => {
  if (error instanceof ApplicationException) {
    return {
      statusCode: error.statusCode,
      body: errorResponse(error.code, error.message, error.details, { requestId }),
    };
  }

  return {
    statusCode: 500,
    body: errorResponse('INTERNAL_SERVER_ERROR', 'An unexpected error occurred', undefined, { requestId }),
  };
};
