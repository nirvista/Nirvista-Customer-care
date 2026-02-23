export const STATUS_MESSAGES = {
    // Success (2xx)
    200: "Success",
    201: "Created successfully",
    204: "No content",

    // Client Errors (4xx)
    400: "Bad request",
    401: "Unauthorized",
    403: "Access Denied",
    404: "Not found",
    409: "Conflict",
    422: "Validation error",

    // Server Errors (5xx)
    500: "Internal server error",
    502: "Bad gateway",
    503: "Service unavailable",
};

export const sendResponse = (res, statusCode, success, data = null, customMessage = null) => {
    const message = customMessage || STATUS_MESSAGES[statusCode] || "Unknown status";
    const response = { success, message };
    if (data) response.data = data;
    return res.status(statusCode).json(response);
};

// Shorthand helpers
export const success = (res, data = null, message = null, statusCode = 200) => 
    sendResponse(res, statusCode, true, data, message);

export const created = (res, data = null, message = null) => 
    sendResponse(res, 201, true, data, message);

export const badRequest = (res, message = null) => 
    sendResponse(res, 400, false, null, message);

export const unauthorized = (res, message = null) => 
    sendResponse(res, 401, false, null, message);

export const forbidden = (res, message = null) => 
    sendResponse(res, 403, false, null, message);

export const notFound = (res, message = null) => 
    sendResponse(res, 404, false, null, message);

export const serverError = (res, message = null) => 
    sendResponse(res, 500, false, null, message);