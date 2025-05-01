import { PrismaClient } from '@prisma/client';
import { ResponseError } from '../../utils/responseError.js';
import asyncHandler from '../../utils/asyncHandler.js';
const prisma = new PrismaClient();


const SCORE_MAPPING = {
    1: 10,   // Strongly Agree
    2: 5,    // Agree
    3: 0,    // Neutral
    4: -5    // Disagree
};

// Helper function to normalize scores
const normalizeScore = (value) =>
    (value !== undefined && value !== null) ? SCORE_MAPPING[value] ?? 0 : 0;

// Predefined error messages
const ERROR_MESSAGES = {
    LEAD_NOT_FOUND: "Lead not found",
    LEAD_REJECTED: "Lead is rejected",
    FEEDBACK_EXISTS: "Feedback already submitted",
    DEFAULT_ERROR: "Failed to submit feedback"
};

export const sendFeedback = asyncHandler(async (req, res) => {
    const { user } = req;
    const feedbackFields = [
        'over_all_interface',
        'navigate',
        'easy_to_apply',
        'customer_centric_approach',
        'recommend_to'
    ];

    // Fetch latest lead with transaction
    const leadDetails = await prisma.$transaction(async (tx) => {
        const lead = await tx.lead.findFirst({
            where: { customer_id: user.id },
            orderBy: { created_at: 'desc' },
            select: {
                id: true,
                is_rejected: true,
                is_feedback_submitted: true,
                customer_id: true,
                pan: true
            }
        });

        if (!lead) throw new ResponseError(400, ERROR_MESSAGES.LEAD_NOT_FOUND);
        if (lead.is_rejected) throw new ResponseError(400, ERROR_MESSAGES.LEAD_REJECTED);
        if (lead.is_feedback_submitted) throw new ResponseError(400, ERROR_MESSAGES.FEEDBACK_EXISTS);

        return lead;
    });

    // Prepare feedback data
    const feedbackData = {
        category: req.body.category || null,
        feedback_text: req.body.feedback_text || null,
        lead_id: leadDetails.id,
        customer_id: leadDetails.customer_id,
        pan: leadDetails.pan,
        ...Object.fromEntries(
            feedbackFields.map(field => [field, normalizeScore(req.body[field])])
        )
    };

    // Create feedback and log in single transaction
    const [feedback] = await prisma.$transaction([
        prisma.feedback_form.create({ data: feedbackData }),
        prisma.lead_Logs.create({
            data: {
                lead_id: leadDetails.id,
                customer_id: user.id,
                pan: leadDetails.pan,
                remarks: "Feedback submitted"
            }
        }),
        prisma.lead.update({
            where: { id: leadDetails.id },
            data: { is_feedback_submitted: true }
        })
    ]);

    return res.status(200).json({
        success: true,
        message: "Feedback submitted successfully",
    });
});

export const addReference = asyncHandler(async (req, res) => {
    const { id: customerId } = req.user;
    const { ref_no_1, ref_no_2, ref_name_1, ref_name_2 } = req.body;

    const ERROR_MESSAGES = {
        REF1_REQUIRED: 'At least one complete reference (Ref 1) is required',
        REF2_PAIR: 'Both Reference 2 fields must be provided together',
        NO_LEAD: 'No lead found for this user',
        REF_EXISTS: 'Reference already added'
    };

    if (!ref_no_1?.trim() || !ref_name_1?.trim()) {
        return res.status(400).json({
            success: false,
            message: ERROR_MESSAGES.REF1_REQUIRED
        });
    }

    if (Boolean(ref_no_2) !== Boolean(ref_name_2)) {
        return res.status(400).json({
            success: false,
            message: ERROR_MESSAGES.REF2_PAIR
        });
    }

    const lead = await prisma.lead.findFirst({
        where: { customer_id: customerId },
        orderBy: { created_at: 'desc' },
        select: {
            id: true,
            pan: true,
            is_reference_added: true
        }
    });

    if (!lead) {
        return res.status(404).json({
            success: false,
            message: ERROR_MESSAGES.NO_LEAD
        });
    }

    if (lead.is_reference_added) {
        return res.status(400).json({
            success: false,
            message: ERROR_MESSAGES.REF_EXISTS
        });
    }

    // Prepare transaction data
    const referenceData = {
        lead_id: lead.id,
        customer_id: customerId,
        pan: lead.pan,
        ref_no_1: ref_no_1.trim(),
        ref_name_1: ref_name_1.trim(),
        ...(ref_no_2 && ref_name_2 && {
            ref_no_2: ref_no_2.trim(),
            ref_name_2: ref_name_2.trim()
        })
    };

    await prisma.$transaction([
        prisma.references.create({ data: referenceData }),
        prisma.lead_Logs.create({
            data: {
                lead_id: lead.id,
                customer_id: customerId,
                pan: lead.pan,
                remarks: 'Reference added successfully!'
            }
        }),
        prisma.lead.update({
            where: { id: lead.id },
            data: { is_reference_added: true }
        })
    ]);

    return res.json({
        success: true,
        message: 'Reference(s) added successfully',
    });
});