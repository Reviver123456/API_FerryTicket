export class AppError extends Error {
  constructor(message, statusCode = 400, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const throwIfError = (error, message = 'Database error', statusCode = null) => {
  if (error) {
    let resolvedMessage = message;
    let resolvedStatus = statusCode ?? 500;

    if (error.code === '23505') {
      resolvedMessage = message === 'Database error' ? 'Record already exists' : message;
      resolvedStatus = statusCode ?? 409;
    } else if (error.code === '23503') {
      resolvedMessage = message === 'Database error' ? 'Referenced record does not exist' : message;
      resolvedStatus = statusCode ?? 409;
    } else if (error.code === 'PGRST116') {
      resolvedMessage = message === 'Database error' ? 'Record not found' : message;
      resolvedStatus = statusCode ?? 404;
    } else if (message !== 'Database error') {
      resolvedStatus = statusCode ?? 400;
    }

    throw new AppError(resolvedMessage, resolvedStatus, { code: error.code || 'unknown_error' });
  }
};

export const assert = (condition, message, statusCode = 400) => {
  if (!condition) {
    throw new AppError(message, statusCode);
  }
};
