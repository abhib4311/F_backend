// middlewares/errorMiddleware.js
import { ResponseError } from '../utils/responseError.js';
import logger from '../utils/logger.js';
import { Prisma } from '@prisma/client';

export const notFound = (req, res, next) => {
  next(new ResponseError(404, `Route not found - ${req.originalUrl}`));
};

export const errorHandler = (err, req, res, next) => {
  logger.error(err);
  // Base error properties
  let statusCode = 500;
  let message = 'Internal Server Error';

  // Handle ResponseError
  if (err instanceof ResponseError) {
    statusCode = err.statusCode;
    message = err.message;
  }
  // Handle Prisma errors
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    message = 'Database operation failed';
    logger.error('Prisma error:', {
      code: err.code,
      meta: err.meta,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });
  }
  // Handle other error types
  else {
    logger.error('Unexpected error:', err);
  }

  // Log all errors
  logger.error({
    status: statusCode,
    method: req.method,
    path: req.originalUrl,
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });

  // Send response
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};