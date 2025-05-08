import { SOURCE } from "../constants/constants.js";


const getPaginationParams = (req) => ({
    page: Math.max(parseInt(req.query.page) || 1, 1),
    limit: Math.min(parseInt(req.query.limit) || 10, 100),
    skip: (parseInt(req.query.page || 1) - 1) * parseInt(req.query.limit || 10)
});

const handleError = (res, error, context) => {
    console.error(`[${new Date().toISOString()}] ${context} Error:`, error.message);
    return res.status(500).json({
        success: false,
        message: `Failed to ${context}`,
        error: error.message
    });
};

const leadSelect = {
    id: true,
    lead_no: true,
    full_name: true,
    mobile: true,
    personal_email: true,
    loan_amount: true,
    created_at: true,
    source: true,
    lead_stage: true,
    allocated_to: true,
    assigned_to: true,
    approved_by: true
};

const sanitizeCategory = (category) => {
    if (typeof category !== "string") return {};

    const upper = category.trim().toUpperCase();

    // Check if it's a valid SOURCE
    const isValidSource = Object.values(SOURCE).includes(upper);

    return isValidSource ? { source: upper } : {};
};

export { getPaginationParams, handleError, leadSelect, sanitizeCategory };