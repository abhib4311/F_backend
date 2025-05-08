export class ResponseError extends Error {
    constructor(statusCode = 500, message = 'Internal Server Error') {
      super(message);
      this.statusCode = statusCode;
      this.name = 'ResponseError';
      Error.captureStackTrace(this, this.constructor);
    }
  }