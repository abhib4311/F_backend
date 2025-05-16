import { PrismaClient } from "@prisma/client";
import { DOCUMENT_TYPE, LEAD_STAGE } from "../../constants/constants.js";
import { validateDisbursal } from "../../utils/disbursalValidator.js";

import {
  getPaginationParams,
  handleError,
  leadSelect,
  sanitizeCategory,
} from "../../utils/queryHelper.js";
import { generatePresignedUrl } from "../../utils/presignedURL.js";
import { ResponseError } from "../../utils/responseError.js";
import { uploadAdditionalFileToS3 } from "../../utils/uploadAdditionalFileToS3.js";
import asyncHandler from "../../utils/asyncHandler.js";

const prisma = new PrismaClient();

// ============================================== Pending Lead Management Controllers ==============================================
export const fetchUnallocatedLeads = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const category = sanitizeCategory(req.params.category);

    const baseFilter = {
      allocated_to: null,
      is_disbursed: false,
      is_rejected: false,
      is_bre_reject: false,
      ...category,
    };
    const [leads, totalLeads] = await Promise.all([
      prisma.lead.findMany({
        where: baseFilter,
        // select: leadSelect,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
      }),
      prisma.lead.count({ where: baseFilter }),
    ]);

    return res.status(200).json({
      success: true,
      leads,
      message: totalLeads
        ? "New leads fetched successfully"
        : "No new leads found",
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalLeads / limit),
        totalItems: totalLeads,
      },
    });
  } catch (error) {
    return handleError(res, error, "fetch pending leads");
  }
};

export const assignMultipleLeadsToEmployee = async (req, res) => {
  try {
    const { leadIds } = req.body;
    const employeeId = req.employee.id;

    const baseFilter = {
      allocated_to: null,
      is_disbursed: false,
      is_bre_reject: false,
      is_rejected: false,
    };
    // Validate input format
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or empty lead IDs format",
      });
    }

    // Convert and validate numeric IDs
    const numericIds = leadIds
      .map((id) => parseInt(id))
      .filter((id) => !isNaN(id));
    if (numericIds.length !== leadIds.length) {
      return res.status(400).json({
        success: false,
        message: "Contains non-numeric lead IDs",
      });
    }

    // Get valid leads that can be assigned
    const validLeads = await prisma.lead.findMany({
      where: {
        id: { in: numericIds },
        ...baseFilter,
      },
    });

    // Check if all leads are valid
    if (validLeads.length !== numericIds.length) {
      const invalidIds = numericIds.filter(
        (id) => !validLeads.some((lead) => lead.id === id)
      );
      return res.status(400).json({
        success: false,
        message: `Invalid or unavailable leads: ${invalidIds.join(", ")}`,
      });
    }

    // Transaction with proper error handling
    await prisma.$transaction(async (tx) => {
      // Update leads
      await tx.lead.updateMany({
        where: { id: { in: numericIds } },
        data: { allocated_to: employeeId },
      });

      // Prepare logs data
      const leadLogs = validLeads.map((lead) => ({
        customer_id: lead.customer_id,
        lead_id: lead.id,
        pan: lead.pan,
        remarks: `Allocated to employee ${employeeId}`,
      }));

      const employeeLogs = validLeads.map((lead) => ({
        employee_id: employeeId,
        remarks: `Lead ${lead.id} allocated`,
      }));

      // Create logs in parallel
      await Promise.all([
        tx.lead_Logs.createMany({ data: leadLogs }),
        tx.employee_Logs.createMany({ data: employeeLogs }),
      ]);
    });

    return res.json({
      success: true,
      message: `${validLeads.length} leads assigned successfully`,
      count: validLeads.length,
    });
  } catch (error) {
    return handleError(res, error, "assign leads");
  }
};
export const fetchMyAllocatedLeads = async (req, res) => {
  try {
    const employeeId = req.employee.id;
    const { page, limit, skip } = getPaginationParams(req);
    const category = sanitizeCategory(req.params.category);

    const baseFilter = {
      allocated_to: employeeId,
      is_disbursed: false,
      is_rejected: false,
      is_bre_reject: false,
      ...category,
    };

    const [leads, totalLeads] = await Promise.all([
      prisma.lead.findMany({
        where: baseFilter,
        // select: leadSelect,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
      }),
      prisma.lead.count({ where: baseFilter }),
    ]);

    return res.status(200).json({
      success: true,
      leads,
      message: totalLeads
        ? "New leads fetched successfully"
        : "No new leads found",
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalLeads / limit),
        totalItems: totalLeads,
      },
    });
  } catch (error) {
    return handleError(res, error, "fetch pending leads");
  }
};

export const fetchMyBrePendingLeads = async (req, res) => {
  try {
    const employeeId = req.employee.id;
    const { page, limit, skip } = getPaginationParams(req);

    const baseFilter = {
      allocated_to: employeeId,
      is_disbursed: false,
      is_rejected: false,
      is_bre_reject: true,
    };

    const [leads, totalLeads] = await Promise.all([
      prisma.lead.findMany({
        where: baseFilter,
        // select: leadSelect,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
      }),
      prisma.lead.count({ where: baseFilter }),
    ]);

    return res.status(200).json({
      success: true,
      leads,
      message: totalLeads
        ? "New leads fetched successfully"
        : "No new leads found",
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalLeads / limit),
        totalItems: totalLeads,
      },
    });
  } catch (error) {
    return handleError(res, error, "fetch pending leads");
  }
};

export const rejectLeadWithRemarks = async (req, res) => {
  try {
    const { id } = req.params;
    const leadId = parseInt(id);
    const { remarks } = req.body;
    const employeeId = req.employee.id;
    // Validation check
    if (!leadId) {
      return res.status(400).json({
        success: false,
        message: "Lead ID is required",
      });
    }
    if (!remarks) {
      return res.status(400).json({
        success: false,
        message: "Remarks are required",
      });
    }
    if (isNaN(leadId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID",
      });
    }
    // Check if the lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    // Check if the lead is already rejected
    if (lead.is_rejected) {
      return res.status(400).json({
        success: false,
        message: "Lead is already rejected",
      });
    }
    // Reject the lead
    await prisma.$transaction(async (tx) => {
      //update lead
      await tx.lead.update({
        where: { id: leadId },
        data: {
          is_rejected: true,
          rejection_remarks: remarks,
          rejected_by: employeeId,
          lead_stage: LEAD_STAGE.MANUALLY_REJECT,
        },
      });
      //prepare log
      const customerId = lead.customer_id;
      const emp_name = req.employee.f_name + " " + req.employee.l_name;
      await prisma.lead_Logs.create({
        data: {
          customer_id: customerId,
          lead_id: leadId,
          pan: lead.pan,
          remarks: `Rejected by ${emp_name} with remarks: ${remarks}`,
        },
      });
      await prisma.employee_Logs.create({
        data: {
          employee_id: employeeId,
          remarks: `Rejected the Lead ${leadId} with remarks: ${remarks}`,
        },
      });
    });
    return res.status(200).json({
      success: true,
      message: "Lead rejected successfully",
    });
  } catch (error) {
    return handleError(res, error, "reject lead");
  }
};

export const fetchMyRejectedLeads = async (req, res) => {
  try {
    const employeeId = req.employee.id;
    const { page, limit, skip } = getPaginationParams(req);

    const baseFilter = {
      allocated_to: employeeId,
      is_rejected: true,
    };

    const [leads, totalLeads] = await Promise.all([
      prisma.lead.findMany({
        where: baseFilter,
        // select: { ...leadSelect, rejection_remarks: true },
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
      }),
      prisma.lead.count({ where: baseFilter }),
    ]);

    return res.status(200).json({
      success: true,
      leads,
      message: totalLeads
        ? "Rejected leads fetched successfully"
        : "No rejected leads found",
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalLeads / limit),
        totalItems: totalLeads,
      },
    });
  } catch (error) {
    return handleError(res, error, "fetch rejected leads");
  }
};

export const fetchMyDisbursedLeadsAsSales = async (req, res) => {
  try {
    const employeeId = req.employee.id;
    const { page, limit, skip } = getPaginationParams(req);

    // Optimize query by creating a base filter
    const baseFilter = {
      allocated_to: employeeId,
      is_disbursed: true,
    };

    // Use Promise.all for parallel execution of queries
    const [leads, totalLeads] = await Promise.all([
      prisma.lead.findMany({
        where: baseFilter,
        // select:
        // leadSelect,
        // sanction: {
        //     select: {
        //         disbursement_amount: true,
        //         disbursement_date: true,
        //     },
        // },
        // disbursal: {
        //     select: {
        //         disbursed_amount: true,
        //         disbursed_date: true,
        //     },
        // },

        skip,
        take: limit,
        orderBy: { created_at: "desc" },
      }),
      prisma.lead.count({ where: baseFilter }),
    ]);

    return res.status(200).json({
      success: true,
      data: leads,
      message: totalLeads
        ? "Disbursed leads fetched successfully"
        : "No disbursed leads found",
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalLeads / limit),
        totalItems: totalLeads,
      },
    });
  } catch (error) {
    return handleError(res, error, "fetch disbursed leads");
  }
};

// ============================================== BRE Rejected Lead Management Controllers ==============================================

export const fetchUnassignedBreRejectedLeads = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);

    // Base filter for BRE rejected and unassigned leads
    const baseFilter = {
      is_bre_reject: true,
      assigned_to: null,
      is_rejected: false,
      is_disbursed: false,
    };

    // Use Promise.all for parallel execution of queries
    const [leads, totalLeads] = await Promise.all([
      prisma.lead.findMany({
        where: baseFilter,
        // select: leadSelect,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
      }),
      prisma.lead.count({ where: baseFilter }),
    ]);

    return res.status(200).json({
      success: true,
      leads,
      message: totalLeads
        ? "Unassigned BRE rejected leads fetched successfully"
        : "No unassigned BRE rejected leads found",
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalLeads / limit),
        totalItems: totalLeads,
      },
    });
  } catch (error) {
    return handleError(res, error, "fetch unassigned BRE rejected leads");
  }
};

export const assignMultipleBreRejectedLeadsToSelf = async (req, res) => {
  try {
    const { leadIds } = req.body;
    const employeeId = req.employee.id;

    const baseFilter = {
      is_bre_reject: true,
      assigned_to: null,
      is_rejected: false,
      is_disbursed: false,
    };
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or empty lead IDs format",
      });
    }

    // Convert and validate numeric IDs
    const numericIds = leadIds
      .map((id) => parseInt(id))
      .filter((id) => !isNaN(id));
    if (numericIds.length !== leadIds.length) {
      return res.status(400).json({
        success: false,
        message: "Contains non-numeric lead IDs",
      });
    }

    // Get valid leads that can be assigned
    const validLeads = await prisma.lead.findMany({
      where: {
        id: { in: numericIds },
        ...baseFilter,
      },
    });

    // Check if all leads are valid
    if (validLeads.length !== numericIds.length) {
      const invalidIds = numericIds.filter(
        (id) => !validLeads.some((lead) => lead.id === id)
      );
      return res.status(400).json({
        success: false,
        message: `Invalid or unavailable leads: ${invalidIds.join(", ")}`,
      });
    }

    // Transaction with proper error handling
    await prisma.$transaction(async (tx) => {
      // Update leads
      await tx.lead.updateMany({
        where: { id: { in: numericIds } },
        data: { assigned_to: employeeId },
      });

      // Prepare logs data
      const leadLogs = validLeads.map((lead) => ({
        customer_id: lead.customer_id,
        lead_id: lead.id,
        pan: lead.pan,
        remarks: `Assigned to employee ${employeeId}`,
      }));

      const employeeLogs = validLeads.map((lead) => ({
        employee_id: employeeId,
        remarks: `Lead ${lead.id} allocated`,
      }));

      // Create logs in parallel
      await Promise.all([
        tx.lead_Logs.createMany({ data: leadLogs }),
        tx.employee_Logs.createMany({ data: employeeLogs }),
      ]);
    });

    return res.json({
      success: true,
      message: `${validLeads.length} leads assigned successfully`,
      count: validLeads.length,
    });
  } catch (error) {
    return handleError(res, error, "assign leads");
  }
};

export const fetchMyBreRejectedLeads = async (req, res) => {
  try {
    const employeeId = req.employee.id;
    const { page, limit, skip } = getPaginationParams(req);
    const baseFilter = {
      is_bre_reject: true,
      assigned_to: employeeId,
      is_rejected: false,
      is_disbursed: false,
    };
    const [leads, totalLeads] = await Promise.all([
      prisma.lead.findMany({
        where: baseFilter,
        // select: leadSelect,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
      }),
      prisma.lead.count({ where: baseFilter }),
    ]);
    return res.status(200).json({
      success: true,
      leads,
      message: totalLeads
        ? "Assigned leads fetched successfully"
        : "No assigned leads found",
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalLeads / limit),
        totalItems: totalLeads,
      },
    });
  } catch (error) {
    return handleError(res, error, "fetch pending leads");
  }
};
export const approveBreRejectedLeadManually = async (req, res) => {
  try {
    const { id } = req.params;
    const leadId = parseInt(id);
    const employeeId = req.employee.id;
    const {
      calculated_loan_amount,
      remarks,
      ifsc_code,
      salary_date,
      bank_acc_no,
    } = req.body;

    // Validation check
    if (!leadId || isNaN(leadId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID",
      });
    }

    // Check if the lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Check if the lead is already rejected
    if (lead.is_rejected) {
      return res.status(400).json({
        success: false,
        message: "Lead is rejected",
      });
    }

    await prisma.$transaction(async (tx) => {
      // Prepare lead update data
      const leadUpdateData = {
        approved_by: employeeId,
        is_bre_reject: false,
        lead_stage: LEAD_STAGE.BRE_APPROVED,
      };

      // Conditionally add loan amount and remarks to lead
      if (calculated_loan_amount !== undefined) {
        leadUpdateData.elegible_loan_amount = Number(calculated_loan_amount);
      }
      if (remarks !== undefined) {
        leadUpdateData.rejection_remarks = remarks;
      }
      if (salary_date !== undefined) {
        leadUpdateData.salary_date = new Date(salary_date);
      }

      // Update lead
      await tx.lead.update({
        where: { id: leadId },
        data: leadUpdateData,
      });

      // Handle bank details
      if (ifsc_code !== undefined || bank_acc_no !== undefined) {
        const bankUpdateData = {};
        if (ifsc_code !== undefined) bankUpdateData.ifsc_code = ifsc_code;
        if (bank_acc_no !== undefined) bankUpdateData.bank_acc_no = bank_acc_no;

        // Upsert bank details
        await tx.bank_Details.updateMany({
          where: { lead_id: leadId },
          data: bankUpdateData,
        });
      }

      // Prepare logs
      const customerId = lead.customer_id;
      const emp_name = `${req.employee.f_name} ${req.employee.l_name}`;

      await tx.lead_Logs.create({
        data: {
          customer_id: customerId,
          lead_id: leadId,
          pan: lead.pan,
          remarks: `Approved by ${emp_name}`,
        },
      });

      await tx.employee_Logs.create({
        data: {
          employee_id: employeeId,
          remarks: `Approved the Lead ${leadId}`,
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: "Lead Approved successfully",
    });
  } catch (error) {
    return handleError(res, error, "approve lead");
  }
};
export const rejectBreRejectedLeadManually = async (req, res) => {
  try {
    const { id } = req.params;
    const leadId = parseInt(id);
    const { remarks } = req.body;
    const employeeId = req.employee.id;
    // Validation check
    if (!leadId) {
      return res.status(400).json({
        success: false,
        message: "Lead ID is required",
      });
    }
    if (!remarks) {
      return res.status(400).json({
        success: false,
        message: "Remarks are required",
      });
    }
    if (isNaN(leadId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID",
      });
    }
    // Check if the lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    // Check if the lead is already rejected
    if (lead.is_rejected) {
      return res.status(400).json({
        success: false,
        message: "Lead is already rejected",
      });
    }
    // Reject the lead
    await prisma.$transaction(async (tx) => {
      //update lead
      await tx.lead.update({
        where: { id: leadId },
        data: {
          is_rejected: true,
          rejection_remarks: remarks,
          rejected_by: employeeId,
          lead_stage: LEAD_STAGE.MANUALLY_REJECT,
        },
      });
      //prepare log
      const customerId = lead.customer_id;
      const emp_name = req.employee.f_name + " " + req.employee.l_name;
      await prisma.lead_Logs.create({
        data: {
          customer_id: customerId,
          lead_id: leadId,
          pan: lead.pan,
          remarks: `Rejected by ${emp_name} with remarks: ${remarks}`,
        },
      });
      await prisma.employee_Logs.create({
        data: {
          employee_id: employeeId,
          remarks: `Rejected the Lead ${leadId} with remarks: ${remarks}`,
        },
      });
    });
    return res.status(200).json({
      success: true,
      message: "Lead rejected successfully",
    });
  } catch (error) {
    return handleError(res, error, "reject lead");
  }
};
export const fetchMyManuallyRejectedLeads = async (req, res) => {
  try {
    const employeeId = req.employee.id;
    const { page, limit, skip } = getPaginationParams(req);

    const baseFilter = {
      rejected_by: employeeId,
      is_rejected: true,
    };

    const [leads, totalLeads] = await Promise.all([
      prisma.lead.findMany({
        where: baseFilter,
        // select: { ...leadSelect, rejection_remarks: true },
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
      }),
      prisma.lead.count({ where: baseFilter }),
    ]);

    return res.status(200).json({
      success: true,
      leads,
      message: totalLeads
        ? "Rejected leads fetched successfully"
        : "No rejected leads found",
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalLeads / limit),
        totalItems: totalLeads,
      },
    });
  } catch (error) {
    return handleError(res, error, "fetch rejected leads");
  }
};
export const fetchMyManuallyApprovedLeads = async (req, res) => {
  try {
    const employeeId = req.employee.id;
    const { page, limit, skip } = getPaginationParams(req);

    const baseFilter = {
      approved_by: employeeId,
      is_bre_reject: false,
      is_rejected: false,
    };

    const [leads, totalLeads] = await Promise.all([
      prisma.lead.findMany({
        where: baseFilter,
        // select: { ...leadSelect },
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
      }),
      prisma.lead.count({ where: baseFilter }),
    ]);

    return res.status(200).json({
      success: true,
      leads,
      message: totalLeads
        ? "Mannualy approved leads fetched successfully"
        : "No mannualy approved leads found",
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalLeads / limit),
        totalItems: totalLeads,
      },
    });
  } catch (error) {
    return handleError(res, error, "fetch rejected leads");
  }
};
export const fetchMyDisbursedLeadsAsCreditAnalyst = async (req, res) => {
  try {
    const employeeId = req.employee.id;
    const { page, limit, skip } = getPaginationParams(req);
    const baseFilter = {
      approved_by: employeeId,
      is_rejected: false,
      assigned_to: employeeId,
    };
    const [leads, totalLeads] = await Promise.all([
      prisma.lead.findMany({
        where: baseFilter,
        // select: { ...leadSelect },
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
      }),
      prisma.lead.count({ where: baseFilter }),
    ]);

    return res.status(200).json({
      success: true,
      leads,
      message: totalLeads
        ? "My disbursed leads fetched successfully"
        : "No disbursed leads found",
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalLeads / limit),
        totalItems: totalLeads,
      },
    });
  } catch (error) {
    return handleError(res, error, "fetch rejected leads");
  }
};
// ======================================================================================================================

export const fetchAllDisbursedLeadsWithDetails = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const baseFilter = {
      is_disbursed: true,
    };

    // Get total count and leads using Prisma
    const [leads, totalLeads] = await Promise.all([
      prisma.lead.findMany({
        where: baseFilter,
        // select: {
        //     ...leadSelect
        // },
        skip,
        take: limit,
        orderBy: {
          created_at: "desc",
        },
      }),
      prisma.lead.count({
        where: baseFilter,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message:
        totalLeads > 0
          ? "Disbursed leads fetched successfully"
          : "No disbursed leads found",
      data: leads,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalLeads / limit),
        totalItems: totalLeads,
      },
    });
  } catch (error) {
    return handleError(res, error, "fetch all Disbursed leads");
  }
};

// ======================================================================Get all closed leads==================================================
// ============================================================================================================================================
// ============================================================================================================================================

export const fetchAllClosedLeadsWithDetails = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);

    // Filter condition for closed leads
    const closedLeadFilter = {
      disbursal: {
        OR: [{ is_writeoff: true }, { is_closed: true }, { is_settled: true }],
      },
    };

    // Fetch paginated closed leads
    const [leads, totalLeads] = await Promise.all([
      prisma.lead.findMany({
        where: closedLeadFilter,
        select: {
          id: true,
          lead_no: true,
          full_name: true,
          mobile: true,
          loan_amount: true,
          created_at: true,
          disbursal: {
            select: {
              loan_no: true,
              disbursal_date: true,
              amount: true,
              payment_mode: true,
              utr: true,
              is_closed: true,
            },
          },
          sanction: {
            select: {
              sanction_amount: true,
              tenure: true,
              interest_rate: true,
              processing_fee: true,
              sanction_date: true,
            },
          },
          collection: {
            select: {
              emi_amount: true,
              emi_date: true,
              payment_status: true,
              payment_mode: true,
              utr_number: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          created_at: "desc",
        },
      }),
      prisma.lead.count({ where: closedLeadFilter }),
    ]);

    return res.status(200).json({
      success: true,
      message:
        closedLeads.length > 0
          ? "Closed leads fetched successfully"
          : "No closed leads found",
      data: leads,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalLeads / limit),
        totalItems: totalCount,
      },
    });
  } catch (error) {
    console.error("Error fetching closed leads with details:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching closed leads.",
      error: error.message,
    });
  }
};

// ============================================================================================================================================
// ============================================================================================================================================
// ============================================================================================================================================
// ============================================================================================================================================
// ================================================================= Get Lead Details by ID====================================================
export const fetchLeadDetailsById = async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return res
        .status(404)
        .json({ status: "error", message: "Lead not found" });
    }

    res.status(200).json({
      success: true,
      message: "Lead details fetched successfully",
      data: lead,
    });
  } catch (error) {
    console.error("Fetch error:", error.message);
    res.status(500).json({
      success: true,
      message: "Failed to fetch lead",
      error: error.message,
    });
  }
};

export const getCustomerDetails = async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);

    // Validate lead ID format
    if (isNaN(leadId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID format",
      });
    }
    // const selectFilter = {
    //     id: true,
    //     customer_no: true,
    //     full_name: true,
    //     pan: true,
    //     gender: true,
    //     dob: true,
    //     mobile: true,
    //     personal_email: true,
    //     employement_type: true,
    //     monthly_income: true,
    //     credit_score: true,
    //     recent_credit_score_date: true,
    //     created_at: true
    // }

    const Lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        customer_id: true,
      },
    });

    if (!Lead || !Lead.customer_id) {
      return res.status(404).json({
        success: false,
        message: "Customer with this Lead not found",
      });
    }
    // Format response
    const customerData = await prisma.customer.findUnique({
      where: { id: Lead.customer_id },
      // select: selectFilter
    });

    return res.status(200).json({
      success: true,
      data: customerData,
    });
  } catch (error) {
    console.error("[CustomerController] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
export const getLoanDetails = async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);

    // Validate lead ID
    if (isNaN(leadId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID format",
      });
    }
    const selectFilter = {
      id: true,
      loan_no: true,
      elegible_loan_amount: true,
      lead_stage: true,
      sanction: true,
      disbursal: true,
    };
    // Single query to fetch all related data
    const loanData = await prisma.lead.findUnique({
      where: { id: leadId },
      select: selectFilter,
    });

    if (!loanData) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Format response data
    // const response = {
    //     loanOverview: {
    //         leadId: loanData.id,
    //         loanNumber: loanData.loan_no,
    //         eligibleAmount: loanData.elegible_loan_amount,
    //         currentStage: loanData.lead_stage
    //     },
    //     sanctionDetails: loanData.sanction ? {
    //         sanctionedAmount: loanData.sanction.loan_amount,
    //         sanctionDate: loanData.sanction.sanction_date,
    //         tenure: loanData.sanction.tenure,
    //         interestRate: loanData.sanction.roi,
    //         processingFee: loanData.sanction.processing_fee,
    //         netDisbursal: loanData.sanction.net_disbursal,
    //         isDisbursed: loanData.sanction.is_disbursed
    //     } : null,
    //     disbursalDetails: loanData.disbursal ? {
    //         disbursalDate: loanData.disbursal.disbursal_date,
    //         disbursedAmount: loanData.disbursal.amount,
    //         utrNumber: loanData.disbursal.utr,
    //         paymentMode: loanData.disbursal.payment_mode,
    //         repaymentDate: loanData.disbursal.repayment_date
    //     } : null
    // };

    return res.status(200).json({
      success: true,
      data: loanData,
    });
  } catch (error) {
    console.error("[LoanController] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
export const getBankDetails = async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);

    // Validate leadId
    if (isNaN(leadId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID. It must be a number.",
      });
    }

    // Fetch bank details
    const bankDetails = await prisma.bank_Details.findMany({
      where: {
        lead_id: leadId,
      },
    });

    // If no data found
    if (!bankDetails || bankDetails.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No bank details found for lead ID: ${leadId}`,
      });
    }

    // Success
    return res.status(200).json({
      success: true,
      data: bankDetails,
    });
  } catch (error) {
    console.error("Error fetching bank details:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching bank details.",
      error: error.message,
    });
  }
};
// get Third Party Lead data==================>
export const getThirdPartyApiResponse = async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);
    const apiType = req.query.api_type;

    if (isNaN(leadId) || !apiType) {
      return res.status(400).json({
        status: "error",
        message: "Invalid lead ID or missing apiType",
      });
    }
    const selectFilter = {
      api_response: true,
      created_at: true,
    };

    // Fetch lead details from the database
    const thirdPartyLeads = await prisma.api_Logs.findMany({
      where: {
        lead_id: leadId,
        api_type: apiType,
      },
      select: selectFilter,
    });

    if (!thirdPartyLeads.length) {
      return res
        .status(404)
        .json({ status: "error", message: "No third-party lead data found" });
    }

    res.status(200).json({
      success: true,
      message: "Third-party lead data fetched successfully",
      data: thirdPartyLeads,
    });
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({
      success: true,
      message: "Failed to fetch third-party lead data",
      error: error.message,
    });
  }
};
export const getLeadLogs = async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);

    // Validate leadId
    if (isNaN(leadId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID. It must be a number.",
      });
    }
    const logs = await prisma.lead_Logs.findMany({
      where: { lead_id: leadId },
      orderBy: { created_at: "desc" },
    });

    if (!logs.length) {
      return res
        .status(404)
        .json({ status: "error", message: "No logs found for this lead" });
    }

    res.status(200).json({
      success: true,
      message: "Lead logs fetched successfully",
      data: logs,
    });
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch lead logs",
      error: error.message,
    });
  }
};
export const getAddress = async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);

    // Validate leadId
    if (isNaN(leadId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID. It must be a number.",
      });
    }

    // Fetch addresses from DB
    const addressList = await prisma.customer_address.findMany({
      where: {
        lead_id: leadId,
      },
      select: {
        address_source: true,
        address: true,
        state: true,
        country: true,
        pincode: true,
        city: true,
      },
    });

    // If no addresses found
    if (!addressList || addressList.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No address found for lead ID: ${leadId}`,
      });
    }

    // Success
    return res.status(200).json({
      success: true,
      data: addressList,
    });
  } catch (error) {
    console.error("Error fetching address:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching address.",
      error: error.message,
    });
  }
};

export const getDocument = async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);

    // Validate leadId
    if (isNaN(leadId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID. It must be a number.",
      });
    }

    // Fetch documents for the given lead ID
    const documents = await prisma.document.findMany({
      where: {
        lead_id: leadId,
      },
      select: {
        document_type: true,
        document_url: true,
        created_at: true,
        remarks: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    // Handle case where no documents exist
    if (!documents || documents.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No documents found for lead ID: ${leadId}`,
      });
    }

    // Success response
    return res.status(200).json({
      success: true,
      data: documents,
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching documents.",
      error: error.message,
    });
  }
};

export const presignedUrl = async (req, res) => {
  try {
    const s3Url = req.query.document_url;

    // Validate input
    if (!s3Url || typeof s3Url !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing document_url in request body.",
      });
    }

    // Generate pre-signed URL (assuming function exists and returns null/undefined on failure)
    const downloadUrl = generatePresignedUrl(s3Url);

    // Check if URL generation failed
    if (!downloadUrl) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate pre-signed URL. Please try again later.",
      });
    }

    // Success response
    return res.status(200).json({
      success: true,
      downloadUrl: downloadUrl,
    });
  } catch (error) {
    console.error("Error generating pre-signed URL:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while generating pre-signed URL.",
      error: error.message,
    });
  }
};
export const getReferenceDetails = async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);
    if (isNaN(leadId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID. It must be a number.",
      });
    }
    const referenceDetails = await prisma.reference_Details.findMany({
      where: { lead_id: leadId },
    });
    if (!referenceDetails || referenceDetails.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No reference details found for lead ID: ${leadId}`,
      });
    }
    return res.status(200).json({
      success: true,
      data: referenceDetails,
    });
  } catch (error) {
    console.error("Error fetching reference details:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching reference details.",
      error: error.message,
    });
  }
};
export const getBSAReport = async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);
    if (isNaN(leadId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID. It must be a number.",
      });
    }
    const lead = await prisma.lead.findFirst({
      where: { id: leadId },
      select: {
        pan: true,
      },
    });
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: `No lead found for lead ID: ${leadId}`,
      });
    }
    const pan = lead.pan;
    let report = await prisma.bank_Statement_Report.findFirst({
      where: {
        pan,
        lead_id: leadId,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    if (!report) {
      report = await prisma.bank_Statement_Report.findFirst({
        where: {
          pan,
        },
        orderBy: {
          created_at: "desc",
        },
      });
    }
    if (!report) {
      return res.status(404).json({
        success: false,
        message: `No BSA report found for lead ID: ${leadId}`,
      });
    }
    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Error fetching BSA report:", error);
    return res.status(500).json({
      success: false,
      message: error?.message,
    });
  }
};

// Update Bank Details
export const updateBankDetails = async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);
    const { bankName, accountNumber, ifsc, accountHolderName, accountType, branchName } = req.body;

    // Validate leadId
    if (!leadId || isNaN(leadId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID. It must be a number.",
      });
    }

    // Validate data
    if (!bankName || !accountNumber || !ifsc || !accountHolderName) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    // Check if lead exists 
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found.",
      });
    }

    // upidate the bank details
    const updatedBankDetails = await prisma.bank_Details.update({
      where: { lead_id: leadId },
      data: {
        bank_name: bankName,
        account_number: accountNumber,
        ifsc: ifsc,
        beneficiary_name: accountHolderName,
        account_type: accountType,
        branch_name: branchName,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Bank details updated successfully.",
      data: updatedBankDetails,
    });
  } catch (error) {
    console.error("Error updating bank details:", error);
    return res.status(500).json({
      success: false,
      message: error?.message,
    });
  }
};



// ============================================================================================================================================
// ============================================================================================================================================
// ============================================================================================================================================
// ============================================================================================================================================
// ================================================================= Bulk Upload Leads ====================================================
export const uploadMarketingLeadsInBulk = async (req, res) => {
  try {
    // Validate file presence
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded. Please upload a CSV file",
      });
    }
    // console.log(req.file)
    // Validate file type
    if (!req.file.mimetype.includes("csv")) {
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Please upload a CSV file",
      });
    }

    // Convert buffer to string and parse CSV
    const csvString = req.file.buffer.toString("utf-8");
    const rows = csvString.split("\n").filter((row) => row.trim() !== "");

    if (rows.length < 2) {
      return res.status(400).json({
        success: false,
        message: "CSV file is empty or contains only headers",
      });
    }

    const headers = rows[0]
      .split(",")
      .map((header) => header.trim().toLowerCase());
    const leads = rows.slice(1);

    // Required fields with validation rules
    const requiredFields = {
      full_name: { type: "string", minLength: 2 },
      mobile: { type: "string", pattern: /^[0-9]{10}$/ },
      pan: { type: "string", pattern: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/ },
      email: { type: "string", pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    };

    // Check for missing required fields
    const missingFields = Object.keys(requiredFields).filter(
      (field) => !headers.includes(field)
    );
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    // Get indexes of required fields
    const fieldIndexes = {};
    headers.forEach((header, index) => {
      if (Object.keys(requiredFields).includes(header)) {
        fieldIndexes[header] = index;
      }
    });

    // Function to split full name into f_name, m_name, l_name
    const splitName = (fullName) => {
      const nameParts = fullName
        .trim()
        .split(" ")
        .filter((n) => n);
      const f_name = nameParts[0] || null;
      const m_name =
        nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : null;
      const l_name =
        nameParts.length > 1 ? nameParts[nameParts.length - 1] : null;
      return { f_name, m_name, l_name };
    };

    // Process each lead
    const processedLeads = [];
    const errors = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < leads.length; i++) {
      try {
        const lead = {};
        const row = leads[i].split(",").map((cell) => cell.trim());

        // Extract and validate required fields
        for (const [field, rules] of Object.entries(requiredFields)) {
          const value = row[fieldIndexes[field]];

          if (!value) {
            throw new Error(`Missing ${field}`);
          }

          if (rules.type === "string") {
            if (rules.minLength && value.length < rules.minLength) {
              throw new Error(`${field} is too short`);
            }
            if (rules.pattern && !rules.pattern.test(value)) {
              throw new Error(`Invalid ${field} format`);
            }
          }

          lead[field] = value;
        }

        // Extract f_name, m_name, l_name from full_name
        const { f_name, m_name, l_name } = splitName(lead.full_name);

        // Check for duplicate PAN
        const existingLead = await prisma.lead.findFirst({
          where: { pan: lead.pan.toUpperCase() },
        });

        if (existingLead) {
          throw new Error(`Lead with PAN ${lead.pan} already exists`);
        }

        // Create lead in database
        const newLead = await prisma.lead.create({
          data: {
            full_name: lead.full_name,
            f_name,
            m_name,
            l_name,
            mobile: lead.mobile,
            pan: lead.pan.toUpperCase(),
            personal_email: lead.email,
            source: SOURCE.MARKETING,
            lead_stage: LEAD_STAGE.PENDING_LEAD,
          },
        });

        processedLeads.push(newLead);
        successCount++;
      } catch (error) {
        errorCount++;
        errors.push({
          row: i + 2,
          error: error.message,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Bulk upload completed",
      data: {
        totalProcessed: leads.length,
        successCount,
        errorCount,
        errors: errors.length > 0 ? errors : null,
        leads: processedLeads,
      },
    });
  } catch (error) {
    console.error("Bulk upload error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process bulk upload",
      error: error.message,
    });
  }
};

export const disbursed = asyncHandler(async (req, res) => {
  const details = req.body;
  const paymentSS = req.file;
  const employee = req.employee;

  // Validate request
  const { error } = validateDisbursal(details);
  if (error)
    return res.status(400).json({
      success: false,
      errors: error.details.map((err) => err.message),
    });

  const result = await prisma.$transaction(
    async (tx) => {
      // Cache frequently used values
      const { loan_no, amount, utr } = details;
      const employeeId = employee.id;
      const employeeName = `${employee.f_name} ${employee.l_name}`;

      // Fetch lead and sanction in parallel where possible
      const lead = await tx.lead.findFirst({
        where: { loan_no },
        orderBy: { created_at: "desc" },
      });
      if (!lead) throw new ResponseError(400, "Lead not found");
      if (lead.is_rejected) throw new ResponseError(400, "Lead rejected");
      if (lead.is_disbursed) throw new ResponseError(400, "Already disbursed");
      if (lead.is_kyc_reject) throw new ResponseError(400, "KYC rejected");

      const sanction = await tx.sanction.findFirst({
        where: {
          lead_id: lead.id,
          is_eSigned: true,
          is_rejected: false,
          is_disbursed: false,
        },
      });
      if (!sanction) throw new ResponseError(400, "Valid sanction not found");
      if (sanction.net_disbursal !== Number(amount)) {
        throw new ResponseError(400, "Amount mismatch with net disbursal");
      }

      // Prepare reusable values
      const leadId = lead.id;
      const pan = lead.pan;
      const customerId = lead.customer_id;
      const netDisbursal = sanction.net_disbursal;

      // Process file upload in parallel with other operations
      const fileUploadPromise = uploadAdditionalFileToS3(
        paymentSS,
        process.env.AWS_S3_BUCKET,
        pan,
        "paymentSS"
      );

      // Process disbursal updates
      const existingDisbursal = await tx.disbursal.findFirst({
        where: { lead_id: leadId },
      });
      if (existingDisbursal?.is_disbursed) {
        throw new ResponseError(400, "Payment already processed");
      }

      // Prepare common data for updates
      const disbursalData = {
        payable_account: details.payable_account,
        payment_mode: details.payment_mode,
        amount: netDisbursal,
        disbursal_date: new Date(details.disbursal_date),
        loan_amount: sanction.loan_amount,
        repayment_date: sanction.repayment_date,
        repayment_amount: sanction.repayment_amount,
        roi: sanction.roi,
        tenure: sanction.tenure,
        disbursed_by: employeeId,
        channel: details.channel,
        remarks: details.remarks,
        pan,
        sanction_id: sanction.id,
        loan_no: sanction.loan_no,
      };

      // Execute upsert operation
      const disbursement = existingDisbursal
        ? await tx.disbursal.update({
          where: { id: existingDisbursal.id },
          data: disbursalData,
        })
        : await tx.disbursal.create({
          data: { ...disbursalData, lead_id: leadId },
        });

      // Create transaction history
      const transactionHistory = await tx.transaction_History.create({
        data: {
          lead_id: leadId,
          loan_no: sanction.loan_no,
          utr,
          payable_account: details.payable_account,
          bank_name: details.bank_name,
          ifsc: details.ifsc,
          payment_mode: details.payment_mode,
          disbursal_id: disbursement.id,
          sanction_id: sanction.id,
          amount: netDisbursal,
        },
      });

      // Update disbursal status
      await tx.disbursal.update({
        where: { id: disbursement.id },
        data: {
          is_disbursed: true,
          utr,
          transaction_history_id: transactionHistory.id,
        },
      });

      // Execute all parallel operations
      await Promise.all([
        // Database operations
        tx.collection.create({
          data: {
            customer_id: customerId,
            pan,
            lead_id: leadId,
            loan_no: sanction.loan_no,
            received_amount: 0,
            collection_active: true,
          },
        }),
        tx.payment.create({
          data: {
            pan,
            lead_id: leadId,
            lead_no: lead.lead_no,
            loan_no: sanction.loan_no,
          },
        }),
        // File upload and document creation
        fileUploadPromise.then((fileUrl) =>
          tx.document.create({
            data: {
              customer_id: customerId,
              pan,
              lead_id: leadId,
              document_type: DOCUMENT_TYPE.ADDITIONAL_DOCUMENT,
              document_url: fileUrl,
              remarks: "Payment SS",
            },
          })
        ),
        // Lead update
        tx.lead.update({
          where: { id: leadId },
          data: {
            is_disbursed: true,
            lead_stage: LEAD_STAGE.DISBURSED,
          },
        }),
        // Logs
        tx.employee_Logs.create({
          data: {
            employee_id: employeeId,
            remarks: `${netDisbursal} disbursed to ${loan_no}`,
          },
        }),
        tx.lead_Logs.create({
          data: {
            customer_id: customerId,
            lead_id: leadId,
            pan,
            remarks: `Disbursed by ${employeeName}`,
          },
        }),
      ]);

      return {
        disbursement_id: disbursement.id,
        loan_no: disbursement.loan_no,
        amount: netDisbursal,
        transaction_id: utr,
      };
    },
    { timeout: 15000 }
  );

  return res.status(200).json({
    success: true,
    message: "Disbursement successful",
    data: result,
  });
});

export const uploadDocument = async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);
    const file = req.file;
    const { file_type } = req.body;

    // Validate input fields
    if (!leadId || isNaN(leadId)) {
      return res.status(400).json({
        success: false,
        message: "Valid lead ID is required",
      });
    }

    if (!file_type) {
      return res.status(400).json({
        success: false,
        message: "Document type is required",
      });
    }

    // Validate file
    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Fetch lead from DB
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        customer_id: true,
        pan: true,
        is_rejected: true,
        full_name: true,
      },
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    if (lead.is_rejected) {
      return res.status(403).json({
        success: false,
        message: "Cannot upload documents for rejected leads",
      });
    }

    // Upload file to S3
    const s3Upload = await uploadAdditionalFileToS3(
      file,
      process.env.AWS_S3_BUCKET,
      lead.pan,
      file_type
    );
    console.log("s3Upload==============>", s3Upload);
    if (s3Upload) {
      console.log("uploaded successfully");
    }

    // Use transaction for database operations
    const result = await prisma.$transaction(async (tx) => {
      const uploadedDoc = await tx.document.create({
        data: {
          lead_id: leadId,
          document_type: DOCUMENT_TYPE.ADDITIONAL_DOCUMENT,
          document_url: s3Upload,
          customer_id: lead.customer_id,
          pan: lead.pan,
          remarks: file_type,
        },
      });

      // Create logs
      await Promise.all([
        tx.lead_Logs.create({
          data: {
            customer_id: lead.customer_id,
            lead_id: leadId,
            pan: lead.pan,
            remarks: `Document ${file_type} uploaded by ${req.employee.f_name} ${req.employee.l_name}   `,
          },
        }),
        tx.employee_Logs.create({
          data: {
            employee_id: req.employee.id,
            remarks: `Document ${file_type} uploaded for lead ${leadId} (${lead.full_name})`,
          },
        }),
      ]);

      return uploadedDoc;
    });

    return res.status(200).json({
      success: true,
      message: "Document uploaded successfully",
      data: {
        documentId: result.id,
        documentType: result.document_type,
        documentUrl: result.document_url,
        uploadDate: result.created_at,
      },
    });
  } catch (error) {
    console.error("Error uploading document:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload document",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};
