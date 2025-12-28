import { AxiosError } from 'axios';

export interface ApiError {
  message: string;
  status?: number;
  details?: any;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const axiosError = error as AxiosError;
    
    if (axiosError.response) {
      const status = axiosError.response.status;
      const data = axiosError.response.data as any;

      // Handle different error status codes
      switch (status) {
        case 400:
          // Bad Request - validation errors
          if (data?.details && Array.isArray(data.details)) {
            return data.details
              .map((d: any) => `${d.path?.join('.') || 'Field'}: ${d.message || 'Invalid value'}`)
              .join(', ');
          }
          return data?.error || data?.message || 'Invalid request. Please check your input.';
        
        case 401:
          return 'Your session has expired. Please log in again.';
        
        case 403:
          return data?.error || 'You do not have permission to perform this action.';
        
        case 404:
          return data?.error || 'The requested resource was not found.';
        
        case 422:
          // Unprocessable Entity - validation errors
          if (data?.details && Array.isArray(data.details)) {
            return data.details
              .map((d: any) => `${d.path?.join('.') || 'Field'}: ${d.message || 'Invalid value'}`)
              .join(', ');
          }
          return data?.error || data?.message || 'Validation failed. Please check your input.';
        
        case 500:
          return data?.error || 'Server error. Please try again later.';
        
        default:
          return data?.error || data?.message || `Request failed with status ${status}`;
      }
    }

    // Network error
    if (axiosError.code === 'ERR_NETWORK' || axiosError.message.includes('Network Error')) {
      return 'Network error. Please check your connection and try again.';
    }

    // Other errors
    return axiosError.message || 'An unexpected error occurred.';
  }

  return 'An unexpected error occurred.';
}

export function getErrorDetails(error: unknown): ApiError {
  if (error instanceof Error) {
    const axiosError = error as AxiosError;
    
    return {
      message: getErrorMessage(error),
      status: axiosError.response?.status,
      details: axiosError.response?.data,
    };
  }

  return {
    message: 'An unexpected error occurred.',
  };
}


