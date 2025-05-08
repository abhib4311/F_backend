import { ResponseError } from '../utils/responseError.js'

export const handleThirdPartyResponseCibil = (responseData) => {
    const errorCode = responseData?.controlData?.errorResponseArray?.[0]?.errorCode;
    const httpStatus = responseData?.status;
    const description = responseData?.controlData?.errorResponseArray?.[0]?.errorMessage?.toLowerCase();

    const errorMappings = {
        http: {
            401: "Unauthorized Access - API Key is missing or invalid",
            402: "Insufficient Credits - Credits expired",
            404: "Service not found",
            405: "Invalid Method",
            408: "Connection timeout",
            413: "Message Size Exceeded",
            415: "Unsupported Media Type",
            500: "Third Party Service Error - Internal processing error",
            503: "Service Unavailable - Source down for maintenance",
            504: "Request Timed Out - Response latency exceeded"
        },
        internal: {
            10002: "Invalid Date",
            10003: "Identifier missing or incorrect",
            10004: "Invalid Chars in Address section",
            10005: "Incorrect State and Pincode",
            90001: "Invalid Token or Token expired",
            90002: "Product / Service Access Error",
        }
    };

    if (errorMappings.internal[errorCode]) {
        throw new ResponseError(
            400,
            `${errorMappings.internal[errorCode]} (Code: ${errorCode})`
        );
    }

    if (httpStatus === 400 && description) {
        if (description.includes("invalid apikey")) {
            throw new ResponseError(400, 'Invalid API Key - Please include a valid "API KEY" in the request header.');
        }
        if (description.includes("invalid cust-ref-id")) {
            throw new ResponseError(400, 'Invalid "cust-ref-id" - Ensure it is correctly included and formatted in the request header.');
        }
        if (description.includes("invalid/missing client-secret")) {
            throw new ResponseError(400, 'Invalid or Missing "client-secret" - Ensure it is included and properly formatted in the request header.');
        }
        if (description.includes("invalid member-ref-id")) {
            throw new ResponseError(400, 'Invalid or Missing "Member-Ref-ID" - Check your request header formatting.');
        }
        if (description.includes("invalid/missing request body")) {
            throw new ResponseError(400, 'Missing or Invalid Request Body - Ensure it matches the API marketplace schema.');
        }
    }

    if (errorMappings.http[httpStatus]) {
        throw new ResponseError(
            httpStatus >= 400 && httpStatus < 500 ? httpStatus : 500,
            `${errorMappings.http[httpStatus]} (HTTP: ${httpStatus})`
        );
    }

    // Fallback
    throw new ResponseError(
        500,
        responseData?.error || "Unknown third party service error"
    );
};