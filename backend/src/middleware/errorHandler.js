import { ZodError } from 'zod';
import { logger } from '../config/logger.js';

export class AppError extends Error {
  constructor(message, statusCode = 500, details = undefined) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = undefined) {
    super(message, 404, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details = undefined) {
    super(message, 409, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', details = undefined) {
    super(message, 401, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied', details = undefined) {
    super(message, 403, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation error', details = undefined) {
    super(message, 400, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests. Please try again later.', details = undefined) {
    super(message, 429, details);
  }
}

export function errorHandler(err, req, res, _next) {
  logger.error(`Error processing ${req.method} ${req.path}:`, {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  // Handle Body-Parser Malformed JSON Syntax Errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MALFORMED_JSON',
        message: 'Invalid JSON payload received in request body.'
      }
    });
  }

  // Handle Mongoose CastError (invalid ObjectId format)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ID_FORMAT',
        message: `Invalid identifier format for field "${err.path}"`
      }
    });
  }

  // Handle Zod Schema Validation Errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request input',
        details: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message
        }))
      }
    });
  }

  // Handle MongoDB Duplicate Key Error (Code 11000)
  if (err.code === 11000) {
    const fields = Object.keys(err.keyPattern || {});
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_KEY_CONFLICT',
        message: `Duplicate resource conflict on field(s): ${fields.join(', ')}`,
        details: err.keyValue
      }
    });
  }

  // Handle Operational AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.name,
        message: err.message,
        details: err.details
      }
    });
  }

  // Generic Uncaught Internal Server Error
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
    }
  });
}
