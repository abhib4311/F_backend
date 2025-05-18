import asyncHandler from "../../utils/asyncHandler.js";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { ADDRESS_SOURCE, API_TYPE, COUNTRY, Employee_Type, LEAD_STAGE, SOURCE, STATE_CODE_MAP } from "../../constants/constants.js";
import { nextSequence } from "../../utils/nextSequence.js"
import { fetchCibilAPI, fetchLocationAPI, fetchOnGridAddress } from "../../service/thirdParty.js";
import { ResponseError } from "../../utils/responseError.js";
// import { fetchOnGridAddress } from "../../service/thirdParty.js";
dotenv.config();
const prisma = new PrismaClient();

export const applyReloan = asyncHandler(async (req, res) => {
  // Helper functions and constants
  const CREDIT_REPORT_DAYS = 90;
  const BANK_STATEMENT_DAYS = 30;

  const createBaseLeadData = async (lead, locationResponse) => ({
    is_reloan_case: true,
    lead_no: await nextSequence(prisma, "lead_no", "FUNDO", 10),
    f_name: lead.f_name,
    m_name: lead.m_name,
    l_name: lead.l_name,
    full_name: lead.full_name,
    pan: lead.pan,
    gender: lead.gender,
    dob: lead.dob,
    // aadhaar: lead.aadhaar,
    mobile: lead.mobile,
    lat: String(locationResponse.coordinates.lat),
    lng: String(locationResponse.coordinates.lng),
    address: locationResponse.address,
    city: locationResponse.city,
    state: locationResponse.state,
    pincode: locationResponse.pincode,
    country: COUNTRY.INDIA,
    customer_id: lead.customer_id,
    source: SOURCE.FUNDO_WEB,
    is_lead_verify_by_otp: true,
    is_person_salaried: true,
    is_employee_type_filled: true
  });

  // Initial checks and setup
  const [user, lead] = await Promise.all([
    prisma.customer.findUnique({ where: { id: req.user.id } }),
    prisma.lead.findFirst({
      where: { customer_id: req.user.id },
      orderBy: { created_at: "desc" },
      include: { disbursal: true }
    })
  ]);

  // Validation checks with detailed logging
  if (!lead) {
    throw new ResponseError(400, "Lead not found",
      `No lead found for user with PAN: ${user.pan}, User ID: ${user.id}`);
  }
  if (!lead.is_closed) {
    throw new ResponseError(400, "Previous loan not closed",
      `Previous loan not closed for user with PAN: ${user.pan}, Lead ID: ${lead.id}`);
  }
  if (lead.is_rejected) {
    throw new ResponseError(400, "Previous loan rejected",
      `Previous loan rejected for user with PAN: ${user.pan}, Lead ID: ${lead.id}`);
  }
  if (lead.disbursal?.is_settled) {
    throw new ResponseError(400, "Loan settled",
      `Previous loan settled for user with PAN: ${user.pan}, Lead ID: ${lead.id}`);
  }
  if (lead.disbursal?.is_write_off) {
    throw new ResponseError(400, "Loan written off",
      `Previous loan written off for user with PAN: ${user.pan}, Lead ID: ${lead.id}`);
  }

  // Location validation
  const { lat, lng } = req.body;
  if (!lat || !lng) {
    throw new ResponseError(400, "Coordinates required",
      `Missing coordinates (lat: ${lat}, lng: ${lng}) for user with PAN: ${user.pan}`);
  }

  const [blackListedPan, locationData] = await Promise.all([
    prisma.blacklisted_pan.findFirst({ where: { pan: user.pan } }),
    fetchLocationAPI(lat, lng)
  ]);

  if (blackListedPan) {
    throw new ResponseError(400, "PAN blacklisted",
      `Blacklisted PAN detected: ${user.pan}, Lead ID: ${lead.id}`);
  }

  const serviceablePincode = locationData?.locationResponse?.pincode;
  if (!serviceablePincode) {
    throw new ResponseError(400, "PIN code not found related to this location",
      `Failed to fetch pincode from coordinates (lat: ${lat}, lng: ${lng}) for user with PAN: ${user.pan}`);
  }

  const pincodeCheck = await prisma.serviceable_pin_code.findFirst({
    where: { pincode: serviceablePincode }
  });

  if (!pincodeCheck) {
    throw new ResponseError(400, "Area not serviceable",
      `Non-serviceable pincode ${serviceablePincode} for user with PAN: ${user.pan}`);
  }

  // CIBIL age calculation
  const cibilLog = await prisma.api_Logs.findFirst({
    where: {
      customer_id: user.id,
      api_type: API_TYPE.CREDIT_REPORT,
      lead_id: lead.id
    },
    orderBy: { created_at: "desc" }
  });

  const cibilAgeDays = cibilLog ?
    Math.floor((Date.now() - cibilLog.created_at.getTime()) / 86400000) :
    CREDIT_REPORT_DAYS + 1;

  const locationResponse = locationData.locationResponse;
  let newLead;
  console.log(cibilAgeDays)

  // Main logic for different age cases
  if (cibilAgeDays > CREDIT_REPORT_DAYS) {
    // Handle >90 days case
    const fullName = [lead.f_name, lead.m_name, lead.l_name].filter(Boolean).join(" ");

    const cibilRequestBody = {
      name: fullName,
      gender: user.gender?.toLowerCase() === "m" ? "male" : "female",
      pan: user.pan,
      mobile: user.mobile,
    };

    const { cibilResponse, cibilRequest } = await fetchCibilAPI(
      cibilRequestBody
    );
    const cibilScore = Number(
      cibilResponse?.data?.credit_score
    );

    const getLoanEligibility = (score) => {
      if (score > 800) return 40000;
      if (score > 750) return 28000;
      if (score > 725) return 22000;
      if (score > 700) return 18000;
      if (score > 650) return 14000;
      return 0;
    };

    const loanEligibility = getLoanEligibility(cibilScore);

    newLead = await prisma.lead.create({
      data: {
        ...await createBaseLeadData(lead, locationResponse),
        // loan_amount: loanEligibility,
        tenure: 30,
        credit_score: cibilScore,
        elegible_loan_amount: loanEligibility,
        lead_stage: LEAD_STAGE.ADD_EMPLOYEMENT
      }
    });

    // Logging and address handling
    await handleCibilLogging(cibilRequestBody, cibilResponse, newLead); // add cibil log creation and third party api call log
    await handleOnGridAddress(user.mobile, newLead.id, user.id, user.pan);   // add on grid address and customer address db creation

  } else if (cibilAgeDays > BANK_STATEMENT_DAYS) {
    // Handle 30-90 days case
    const baseData = await createBaseLeadData(lead, locationResponse);
    newLead = await prisma.lead.create({
      data: {
        ...baseData,
        // loan_amount: lead.loan_amount,
        tenure: 30,
        credit_score: lead.credit_score,
        elegible_loan_amount: lead.elegible_loan_amount,
        is_office_email_verify: true,
        is_personal_email_verify: true,
        personal_email: lead.personal_email,
        office_email: lead.office_email,
        is_kyc_approved: true,
        aadhaar: lead.aadhaar,
        lead_stage: LEAD_STAGE.VRIFY_EMAIL_OTP
      }
    });

  } else {
    // Handle <=30 days case
    const baseData = await createBaseLeadData(lead, locationResponse);
    newLead = await prisma.lead.create({
      data: {
        ...baseData,
        aadhaar: lead.aadhaar,
        // loan_amount: lead.loan_amount,
        tenure: lead.tenure,
        credit_score: lead.credit_score,
        elegible_loan_amount: lead.elegible_loan_amount,
        is_office_email_verify: true,
        is_personal_email_verify: true,
        personal_email: lead.personal_email,
        office_email: lead.office_email,
        is_kyc_approved: true,
        is_bsa_complete: true,
        is_bre_complete: true,
        salary_date: lead.salary_date,
        // monthly_income: lead?.monthly_income || 0,
        lead_stage: LEAD_STAGE.BRE_APPROVED
      }
    });
  }

  // Post-creation operations
  await handlePostCreation(user, newLead, locationResponse, cibilAgeDays); // add geo location address, cust updatte,lead log creation

  // Response
  res.status(200).json({
    success: true,
    message: "Reloan processed",
    data: {
      leadId: newLead.id,
      LEAD_STAGE: getNextStep(cibilAgeDays).step,
      SLAB: getNextStep(cibilAgeDays).slab,
    }
  });

  // Helper functions
  async function handleCibilLogging(request, response, lead) {
    await prisma.$transaction([
      prisma.api_Logs.create({
        data: {
          is_reloan_case: true,
          pan: lead.pan,
          api_type: API_TYPE.CREDIT_REPORT,
          api_provider: 1,
          api_request: request,
          api_response: response,
          api_status: true,
          lead_id: lead.id,
          customer_id: lead.customer_id,
        }
      }),
      prisma.lead_Logs.create({
        data: {
          customer_id: lead.customer_id,
          lead_id: lead.id,
          pan: lead.pan,
          remarks: "New CIBIL check for reloan"
        }
      })
    ]);
  }

  async function handleOnGridAddress(mobile, leadId, userId, pan) {
    const { onGridResponse } = await fetchOnGridAddress(mobile);
    const addresses = onGridResponse?.data?.address_data || [];

    if (addresses.length > 0) {
      await prisma.customer_address.createMany({
        data: addresses.map(addr => ({
          customer_id: userId,
          lead_id: leadId,
          pan,
          address_source: ADDRESS_SOURCE.ON_GRID,
          address: `${addr.line1}, ${addr.line2}`.substring(0, 255),
          state: addr.state || "",
          city: addr.city || "",
          pincode: addr.pincode || "",
          country: addr.country || ""
        }))
      });
    }
  }

  async function handlePostCreation(user, newLead, location, days) {
    await prisma.$transaction([
      prisma.customer_address.create({
        data: {
          customer_id: user.id,
          lead_id: newLead.id,
          pan: user.pan,
          address_source: ADDRESS_SOURCE.GEO_LOCATION,
          address: location.address,
          city: location.city,
          state: location.state,
          pincode: location.pincode,
          country: COUNTRY.INDIA
        }
      }),
      prisma.customer.update({
        where: { id: user.id },
        data: {
          credit_score: newLead.credit_score,
          loan_count: { increment: 1 },
          personal_email: newLead.personal_email,
          office_email: newLead.office_email
        }
      }),
      prisma.lead_Logs.create({
        data: {
          customer_id: user.id,
          lead_id: newLead.id,
          pan: user.pan,
          remarks: `Reloan processed - CIBIL age ${days} days`
        }
      })
    ]);
  }

  function getNextStep(days) {
    if (days > 90) return { step: "full_kyc_verification", slab: 1 };
    if (days > 30) return { step: "bank_statement_upload", slab: 2 };
    return { step: "loan_agreement_signature", slab: 3 };
  }
});

export const getLoanStatus = asyncHandler(
  async (req, res) => {
    const customerId = req.user.id;

    const lead = await prisma.lead.findFirst({
      where: { customer_id: customerId },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        is_rejected: true,
        full_name: true,
        credit_score: true
      }
    });

    if (!lead) {
      return res.status(404).json({ message: "No loan application found" });
    }

    if (lead.is_rejected) {
      return res.status(200).json({
        status: "rejected",
        message: "Your loan application has been rejected."
      });
    }

    const [sanctionDetails, disbursalDate] = await Promise.all([
      prisma.sanction.findFirst({
        where: { lead_id: lead.id },
        select: {
          net_disbursal: true,
          repayment_date: true,
          repayment_amount: true
        }
      }),
      prisma.disbursal.findFirst({
        where: { lead_id: lead.id },
        orderBy: { created_at: "desc" },
        select: { disbursal_date: true }
      })
    ]);

    const data = {
      amount_disbursed: sanctionDetails?.net_disbursal ?? 0,
      sanction_loan_amount: sanctionDetails?.loan_amount ?? 0,
      disbursed_date: disbursalDate?.disbursal_date ?? new Date(),
      repayment_date: sanctionDetails?.repayment_date ?? null,
      repayment_amount: sanctionDetails?.repayment_amount ?? 0,
      full_name: lead.full_name,
      credit_score: lead.credit_score,
      loyalty_point: 250 // later it will be dynamic
    };

    return res.status(200).json({
      message: "Loan status retrieved successfully",
      data
    });
  }
);

export const getMaxElegibleloanAmount = asyncHandler(async (req, res) => {
  const CREDIT_REPORT_DAYS = 90;
  const BANK_STATEMENT_DAYS = 30;
  const user = await prisma.customer.findUnique({
    where: { id: req.user.id },
  });

  // find latest lead
  const lead = await prisma.lead.findFirst({
    where: { customer_id: user.id },
    orderBy: { created_at: "desc" },
  });

  if (!lead) {
    throw new ResponseError(400, "Lead not found",
      `No lead found for user with PAN: ${user.pan}, User ID: ${user.id}`);
  }

  if (lead.is_rejected) {
    throw new ResponseError(400, "Your Lead has been rejected",
      `Lead rejected for user with PAN: ${user.pan}, Lead ID: ${lead.id}`);
  }

  // CIBIL age calculation
  const cibilLog = await prisma.api_Logs.findFirst({
    where: {
      customer_id: user.id,
      api_type: API_TYPE.CREDIT_REPORT,
    },
    orderBy: { created_at: "desc" }
  });

  const cibilAgeDays = cibilLog ?
    Math.floor((Date.now() - cibilLog.created_at.getTime()) / 86400000) :
    CREDIT_REPORT_DAYS + 1;

  let case_slab
  if (cibilAgeDays > CREDIT_REPORT_DAYS) {

    case_slab = 3
  }
  else if (cibilAgeDays > BANK_STATEMENT_DAYS) {

    case_slab = 2
  }
  else {
    case_slab = 1

  }

  return res.status(200).json({
    message: "Get Details Sucessfully",
    data: {
      case: case_slab, // case : 3 for  30 days 
      elegible_loan_amount: lead.elegible_loan_amount
    }
  })

})