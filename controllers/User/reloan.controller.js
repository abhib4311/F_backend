import asyncHandler from "../../utils/asyncHandler.js";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
// import { fetchOnGridAddress } from "../../service/thirdParty.js";
dotenv.config();
const prisma = new PrismaClient();

export const applyReloan = asyncHandler(async (req, res) => {

  /*

  ------------ Reloan Journey -----------
  1.send-otp---->  
  2.verify-otp----> 
  3.add-employement(optional)---->  
  4.send-email-otp(optional)---->
  5.verify-email-otp(optional)---->  
  6.upload-bank-statement(30Days(optional))---->  
  7.request-loan(mandatory)---->
  8.initiate-kyc(90Days(optional))---->  
  9.submit-aadhar-otp(90Days(optional))---->  
  10.preview-sanction(mandatory)---->
  11.redirect-url(mandatory)---->  
  12.disbursed(mandatory)

  --------------- Implement the steps --------------------
  1. check the previous lead status which is closed or not 
  2. if closed then create new lead
  3. if not closed then return error
  4. check the previous disbursal status which is closed or writt off or settlement 
  5. check previous 
     5.1 recent CIBIL date (less then 90 days) if excede limit then fetch CIBIL
     5.2 recent Aadhaar KYC (less then 90 days) if excede then flag false(manage previous journey flag also)
     5.3 bank statement (less then 30 days) if axcede then false the flag(manage previous journey flag also)
  6. fetch geo location is a mandatory step for every condition
  7. update the lead data according to above condition in which condition lie this lead
  8. 

  */
  const user = await prisma.customer.findUnique({
    where: {
      id: req.user.id,
    },
  });
  const lead = await prisma.lead.findFirst({
    where: {
      customer_id: user.id,
    },
    orderBy: {
      created_at: "desc",
    },
  });
  if (!lead) {
    throw new ResponseError(400, "Lead not found")
  }
  if (!lead.is_closed) {
    throw new ResponseError(400, "Your previous loan application has been closed.");
  }
  if (lead.is_rejected) {
    res.status(200).json({
      status: "rejected",
      message: "Your loan application has been rejected.",
    });
  }
  if (lead.is_disbursed) {
    res.status(200).json({
      status: "disbursed",
      message: "Your loan application has been disbursed.",
    });
  }
  if (lead.is_settled) {
    res.status(200).json({
      status: "settled",
      message: "Your loan application has been settled.",
    });
  }
  if (lead.is_writt_off) {
    res.status(200).json({
      status: "writt off",
      message: "Your loan application has been writt off.",
    });
  }

  // check previous cibil check date
  const cibilCheckDate = new Date(lead.cibil_check_date);
  const currentDate = new Date();
  const diffInDays = Math.floor(
    (currentDate - cibilCheckDate) / (1000 * 60 * 60 * 24)
  );
  if (diffInDays > 90) {
    // fetch cibil
  }
  // check previous aadhaar kyc date
  const aadhaarKycDate = new Date(lead.aadhaar_kyc_date);
  const diffInDaysAadhaar = Math.floor(
    (currentDate - aadhaarKycDate) / (1000 * 60 * 60 * 24)
  );
  if (diffInDaysAadhaar > 90) {
    // fetch aadhaar kyc
  }
  // check previous bank statement date
  const bankStatementDate = new Date(lead.bank_statement_date);
  const diffInDaysBankStatement = Math.floor(
    (currentDate - bankStatementDate) / (1000 * 60 * 60 * 24)
  );
  if (diffInDaysBankStatement > 30) {
    // fetch bank statement
  }
  // fetch geo location
  const geoLocation = await fetchOnGridAddress(user.pan);
  if (Object.keys(geoLocation).length === 0) {
    res.status(200).json({
      status: "error",
      message: "Unable to fetch geo location",
    });
  }
  // create a new lead 
  const newLead = await prisma.lead.create({
    data: {
      customer_id: user.id,
      pan: user.pan,
      lead_stage: LEAD_STAGE.RELOAN,
      geo_location: geoLocation,
    },
  });

  // update the lead data according to above condition in which condition lie this lead  flag like is kyc approved , bsa bre according to time differnce 
  // update it dynamilcally not forcefully true or false according to above condition
  const updatedLead = await prisma.lead.update({
    where: {
      id: newLead.id,
    },
    data: {
      is_kyc_approved: true,
      is_bsa_approved: true,
      is_bre_approved: true,
      is_cibil_approved: true,
      is_cibil_check: true,
      is_aadhaar_kyc: true,
      is_aadhaar_kyc_check: true,
      is_bank_statement: true,
      is_bank_statement_check: true,
      is_disbursed: false,
      is_writt_off: false,
      is_settled: false,
      is_rejected: false,
      is_closed: false,
    },
  });


});

export const getLoanStatus = asyncHandler(async (req, res) => {
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
        repayment_amount: true,
        loan_amount: true
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
    loan_amount: sanctionDetails?.loan_amount ?? 0,
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
});
