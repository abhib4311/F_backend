import { ResponseError } from '../utils/responseError.js'
export const handleThirdPartyResponse = (responseData) => {
  const statusCode = responseData?.["status-code"] ?? responseData?.statusCode;
  const httpStatus = responseData?.status;

  const errorMappings = {
    // HTTP Status Code Messages
    http: {
      400: "Bad Request - Mandatory fields are missing/invalid",
      401: "Unauthorized Access - API Key is missing or invalid",
      402: "Insufficient Credits - Credits expired",
      500: "Third Party Service Error - Internal processing error",
      503: "Service Unavailable - Source down for maintenance",
      504: "Request Timed Out - Response latency exceeded"
    },

    // Internal Status Code Messages
    internal: {
      102: "Invalid ID number or combination of inputs",
      103: "No records found or invalid image format",
      104: "Max retries exceeded",
      105: "Missing Consent",
      106: "Multiple records exist",
      107: "Feature not supported",
      108: "Internal resource unavailable",
      109: "Too many records found"
    }
  };

  // Throw for internal status codes (102-109)
  if (errorMappings.internal[statusCode]) {
    throw new ResponseError(
      400,
      `${errorMappings.internal[statusCode]} (Code: ${statusCode})`
    );
  }

  // Throw for HTTP status codes
  if (errorMappings.http[httpStatus]) {
    throw new ResponseError(
      httpStatus >= 400 && httpStatus < 500 ? httpStatus : 500,
      `${errorMappings.http[httpStatus]} (HTTP: ${httpStatus})`
    );
  }

  // Fallback error
  throw new ResponseError(
    500,
    responseData?.error || "Unknown third party service error"
  );
};


export const handleSurepassResponse = (responseData) => {
  const httpStatus = responseData?.status_code;

  const errorMappings = {
    http: {
      400: "Bad Request - Malformed request",
      401: "Unauthorized - Invalid authorization credentials",
      403: "Forbidden - Action prohibited",
      404: "Not Found - Resource not found",
      422: "Unprocessable Entity - Validation error",
      429: "Too Many Requests - Rate limit reached",
      500: "Internal Server Error - An unexpected error occurred on Surepass' server",
    },
    success: {
      200: "OK - Successful request",
      201: "Created - Resource successfully created",
      202: "Accepted - Asynchronous request; response will be sent to configured webhook",
      204: "No Content - Successful with no response",
    },
  };

  // Handle error HTTP codes
  if (errorMappings.http[httpStatus]) {
    throw new ResponseError(
      httpStatus >= 400 && httpStatus < 500 ? httpStatus : 500,
      `${errorMappings.http[httpStatus]} (HTTP: ${httpStatus})`
    );
  }

  // Fallback for unknown status
  throw new ResponseError(
    500,
    responseData?.error || "Unknown error from Surepass service"
  );
};
